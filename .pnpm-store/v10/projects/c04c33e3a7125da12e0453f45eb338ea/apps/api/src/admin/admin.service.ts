import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { unwrap, unwrapList, unwrapRequired } from '../common/db';
import { addDays, startOfZonedDay, zonedDate } from '../common/time';
import { RANGE_DAYS } from '../inventory/inventory.service';
import {
  productsExpiringWithin,
  stockLevel,
  toNumber,
} from '../inventory/stock-metrics';

type Row = Record<string, any>;

/** Items on the printed prescription (PostgREST returns the embedded count as [{ count }]). */
function printedLabelCount(printEvent: Row): number {
  const rx = printEvent.prescriptions as Row | null;
  return toNumber(rx?.prescription_items?.[0]?.count);
}

/**
 * Dashboard, analytics and admin record views.
 *
 * Every number is computed from stored records. A failed query is an error (the page shows
 * "could not load"), never a zero and never an invented figure. A zero means the query
 * succeeded and found nothing.
 */
@Injectable()
export class AdminService {
  private readonly timeZone: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('PHARMACY_TIMEZONE') ?? 'Asia/Colombo';
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  private dayStart(offsetDays = 0): string {
    return startOfZonedDay(
      this.timeZone,
      addDays(zonedDate(this.timeZone), offsetDays),
    ).toISOString();
  }

  private localDate(iso: string): string {
    return zonedDate(this.timeZone, new Date(iso));
  }

  private localHour(iso: string): number {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: this.timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(iso)),
    );
  }

  private rangeDays(range?: string): number {
    const value = range ?? '30d';
    const days = RANGE_DAYS[value];
    if (!days)
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: 'Range must be 7d, 30d, or 90d.',
      });
    return days;
  }

  /** Prescriptions, labels, patients and items for [from, to). */
  private async dayFigures(from: string, to: string) {
    const [rxRes, printRes, movementsRes] = await Promise.all([
      this.db
        .from('prescriptions')
        .select('id, customer_id, prescription_items(quantity)')
        .gte('created_at', from)
        .lt('created_at', to),
      this.db
        .from('prescription_events')
        .select('id, prescriptions(prescription_items(count))')
        .in('event_type', ['PRINTED', 'REPRINTED'])
        .gte('created_at', from)
        .lt('created_at', to),
      this.db
        .from('inventory_movements')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from)
        .lt('created_at', to),
    ]);
    const rx = unwrapList(rxRes, 'load prescriptions');
    const prints = unwrapList(printRes, 'load print history');
    unwrap(movementsRes, 'load inventory movement count');

    const registered = new Set(
      rx.filter((r: Row) => r.customer_id).map((r: Row) => r.customer_id),
    );
    return {
      prescriptions: rx.length,
      /** One label per prescription item, for every print or reprint. */
      labelsPrinted: prints.reduce(
        (sum: number, p: Row) => sum + printedLabelCount(p),
        0,
      ),
      printJobs: prints.length,
      registeredPatients: registered.size,
      walkInPrescriptions: rx.filter((r: Row) => !r.customer_id).length,
      itemsDispensed: rx.reduce(
        (sum: number, r: Row) =>
          sum +
          (r.prescription_items ?? []).reduce(
            (s: number, i: Row) => s + toNumber(i.quantity),
            0,
          ),
        0,
      ),
      inventoryMovements: movementsRes.count ?? 0,
    };
  }

  async getSummary() {
    const [today, yesterday, products, batches, patients] = await Promise.all([
      this.dayFigures(this.dayStart(0), this.dayStart(1)),
      this.dayFigures(this.dayStart(-1), this.dayStart(0)),
      this.db
        .from('products')
        .select(
          'id, stock_quantity, minimum_stock, reorder_level, is_active, expiry_date',
        ),
      this.db
        .from('product_batches')
        .select('product_id, quantity_available, expiry_date')
        .gt('quantity_available', 0),
      this.db.from('customers').select('id', { count: 'exact', head: true }),
    ]);
    const productRows = unwrapList(products, 'load products');
    const batchRows = unwrapList(batches, 'load batches');
    unwrap(patients, 'load patient count');

    const levels = productRows
      .filter((p) => p.is_active !== false)
      .map(stockLevel);
    return {
      asOf: new Date().toISOString(),
      timeZone: this.timeZone,
      totalPatients: patients.count ?? 0,
      today,
      yesterday,
      inventory: {
        lowStock: levels.filter((l) => l === 'LOW' || l === 'CRITICAL').length,
        outOfStock: levels.filter((l) => l === 'OUT_OF_STOCK').length,
        /** Active products without a reorder level or minimum stock; not counted as low or healthy. */
        noThreshold: levels.filter((l) => l === 'UNCLASSIFIED').length,
        expiring30Days: productsExpiringWithin(
          productRows,
          batchRows,
          zonedDate(this.timeZone),
          30,
        ).size,
      },
    };
  }

  async getActivity(range = '30d') {
    const days = this.rangeDays(range);
    const today = zonedDate(this.timeZone);
    const from = startOfZonedDay(
      this.timeZone,
      addDays(today, -(days - 1)),
    ).toISOString();
    const to = startOfZonedDay(this.timeZone, addDays(today, 1)).toISOString();

    const [rxRes, printRes] = await Promise.all([
      this.db
        .from('prescriptions')
        .select('created_at, prescription_items(quantity)')
        .gte('created_at', from)
        .lt('created_at', to),
      this.db
        .from('prescription_events')
        .select('created_at, prescriptions(prescription_items(count))')
        .in('event_type', ['PRINTED', 'REPRINTED'])
        .gte('created_at', from)
        .lt('created_at', to),
    ]);
    const rx = unwrapList(rxRes, 'load prescriptions');
    const prints = unwrapList(printRes, 'load print history');

    const buckets = new Map<
      string,
      { date: string; prescriptions: number; labels: number; items: number }
    >();
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      buckets.set(date, { date, prescriptions: 0, labels: 0, items: 0 });
    }
    for (const r of rx) {
      const bucket = buckets.get(this.localDate(r.created_at));
      if (!bucket) continue;
      bucket.prescriptions++;
      bucket.items += (r.prescription_items ?? []).reduce(
        (s: number, i: Row) => s + toNumber(i.quantity),
        0,
      );
    }
    for (const p of prints) {
      const bucket = buckets.get(this.localDate(p.created_at));
      if (bucket) bucket.labels += printedLabelCount(p);
    }
    return [...buckets.values()];
  }

  async getStatusBreakdown(range = '30d') {
    const days = this.rangeDays(range);
    const from = this.dayStart(-(days - 1));
    const to = this.dayStart(1);
    const rx = unwrapList(
      await this.db
        .from('prescriptions')
        .select('status, created_at')
        .gte('created_at', from)
        .lt('created_at', to),
      'load prescriptions',
    );

    const status = new Map<string, number>();
    const periods = [
      { period: 'Before 8am', test: (h: number) => h < 8, count: 0 },
      {
        period: 'Morning (8am–12pm)',
        test: (h: number) => h >= 8 && h < 12,
        count: 0,
      },
      {
        period: 'Afternoon (12pm–5pm)',
        test: (h: number) => h >= 12 && h < 17,
        count: 0,
      },
      {
        period: 'Evening (5pm–9pm)',
        test: (h: number) => h >= 17 && h < 21,
        count: 0,
      },
      { period: 'After 9pm', test: (h: number) => h >= 21, count: 0 },
    ];
    for (const r of rx) {
      status.set(r.status, (status.get(r.status) ?? 0) + 1);
      const h = this.localHour(r.created_at);
      periods.find((p) => p.test(h))!.count++;
    }
    return {
      range: `${days}d`,
      total: rx.length,
      status: [...status.entries()].map(([name, value]) => ({ name, value })),
      timeOfDay: periods.map(({ period, count }) => ({ period, count })),
    };
  }

  async getTopProducts(range = '30d', limit = 5) {
    const days = this.rangeDays(range);
    const today = zonedDate(this.timeZone);
    const from = startOfZonedDay(
      this.timeZone,
      addDays(today, -(days - 1)),
    ).toISOString();
    const to = startOfZonedDay(this.timeZone, addDays(today, 1)).toISOString();
    const items = unwrapList(
      await this.db
        .from('prescription_items')
        .select('product_id, product_name_snapshot, quantity')
        .gte('created_at', from)
        .lt('created_at', to),
      'load dispensed items',
    );
    const totals = new Map<string, { name: string; dispensed: number }>();
    for (const item of items) {
      const key = item.product_id ?? `name:${item.product_name_snapshot}`;
      const entry = totals.get(key) ?? {
        name: item.product_name_snapshot,
        dispensed: 0,
      };
      entry.dispensed += toNumber(item.quantity);
      totals.set(key, entry);
    }
    return [...totals.values()]
      .sort((a, b) => b.dispensed - a.dispensed)
      .slice(0, Math.min(Math.max(limit, 1), 50));
  }

  /** Alerts derived from current stock records only. */
  async getAlerts() {
    const summary = await this.getSummary();
    const alerts: Row[] = [];
    if (summary.inventory.outOfStock > 0) {
      alerts.push({
        id: 'out_of_stock',
        type: 'CRITICAL',
        title: 'Out of stock',
        message: `${summary.inventory.outOfStock} active product(s) have 0 units recorded.`,
        href: '/admin/inventory/low-stock',
        icon: 'PackageX',
      });
    }
    if (summary.inventory.lowStock > 0) {
      alerts.push({
        id: 'low_stock',
        type: 'HIGH',
        title: 'Low stock',
        message: `${summary.inventory.lowStock} product(s) are at or below their reorder level.`,
        href: '/admin/inventory/low-stock',
        icon: 'TriangleAlert',
      });
    }
    if (summary.inventory.expiring30Days > 0) {
      alerts.push({
        id: 'expiring',
        type: 'WARNING',
        title: 'Expired or expiring within 30 days',
        message: `${summary.inventory.expiring30Days} product(s) have stock that is expired or expires within 30 days.`,
        href: '/admin/inventory/expiry',
        icon: 'Calendar',
      });
    }
    if (summary.inventory.noThreshold > 0) {
      alerts.push({
        id: 'no_threshold',
        type: 'INFO',
        title: 'Reorder levels not set',
        message: `${summary.inventory.noThreshold} product(s) have no reorder level, so low stock cannot be detected for them.`,
        href: '/admin/inventory/products',
        icon: 'Info',
      });
    }
    return alerts;
  }

  async getRecentActivity(limit = 10) {
    const events = unwrapList(
      await this.db
        .from('prescription_events')
        .select(
          'id, event_type, created_at, prescriptions(prescription_number, customer_name_text)',
        )
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 100)),
      'load recent activity',
    );
    const verbs: Record<string, string> = {
      CREATED: 'created',
      PRINTED: 'printed',
      REPRINTED: 'reprinted',
      SMS_SENT: 'SMS sent',
      SMS_FAILED: 'SMS failed',
      CANCELLED: 'cancelled',
    };
    return events.map((ev: Row) => ({
      id: ev.id,
      at: ev.created_at,
      type: ev.event_type,
      prescriptionNumber: ev.prescriptions?.prescription_number ?? null,
      message: `Prescription ${ev.prescriptions?.prescription_number ?? '(deleted)'} ${verbs[ev.event_type] ?? ev.event_type.toLowerCase()}`,
    }));
  }

  /** Checks that are actually performed. Printer and SMS gateway state are not observable from the API. */
  async getHealth() {
    const started = Date.now();
    const { error } = await this.db
      .from('products')
      .select('id', { count: 'exact', head: true });
    return {
      checkedAt: new Date().toISOString(),
      api: { status: 'ok' },
      database: error
        ? { status: 'error' }
        : { status: 'ok', latencyMs: Date.now() - started },
    };
  }

  async getPatientProfile(id: string) {
    const [patientRes, rxRes] = await Promise.all([
      this.db.from('customers').select('*').eq('id', id).maybeSingle(),
      this.db
        .from('prescriptions')
        .select('*, prescription_items(*)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
    ]);
    const patient = unwrapRequired(patientRes, 'load the patient');
    const prescriptions = unwrapList(rxRes, "load the patient's prescriptions");

    const counts = new Map<string, number>();
    for (const r of prescriptions) {
      for (const i of r.prescription_items ?? [])
        counts.set(
          i.product_name_snapshot,
          (counts.get(i.product_name_snapshot) ?? 0) + 1,
        );
    }
    return {
      patient,
      stats: {
        totalPrescriptions: prescriptions.length,
        lastVisit: prescriptions[0]?.created_at ?? null,
        frequentlyDispensed: [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name),
      },
      prescriptions,
    };
  }

  async getProductMovements(id: string) {
    return unwrapList(
      await this.db
        .from('inventory_movements')
        .select(
          '*, prescriptions(prescription_number), product_batches(batch_number)',
        )
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(500),
      'load stock movements',
    );
  }

  async getPrescriptions(query?: string, status?: string) {
    let q = this.db
      .from('prescriptions')
      .select('*, prescription_items(*)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (status && status !== 'ALL') q = q.eq('status', status);
    const data = unwrapList(await q, 'load prescriptions');

    const term = query?.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (r: Row) =>
        r.prescription_number?.toLowerCase().includes(term) ||
        r.customer_name_text?.toLowerCase().includes(term) ||
        r.customer_phone?.includes(term),
    );
  }

  async getPrescriptionById(id: string) {
    const [rxRes, eventsRes] = await Promise.all([
      this.db
        .from('prescriptions')
        .select('*, prescription_items(*), customers(*)')
        .eq('id', id)
        .maybeSingle(),
      this.db
        .from('prescription_events')
        .select('*')
        .eq('prescription_id', id)
        .order('created_at', { ascending: false }),
    ]);
    return {
      prescription: unwrapRequired(rxRes, 'load the prescription'),
      events: unwrapList(eventsRes, 'load the prescription history'),
    };
  }

  /**
   * Records that a label was reprinted (no stock change). The web app only calls this after it
   * has actually printed the label.
   */
  async reprintPrescriptionLabel(id: string, reason: string, userId: string) {
    if (!reason?.trim())
      throw new BadRequestException('A reason is required to reprint a label.');

    const rx = unwrap(
      await this.db
        .from('prescriptions')
        .select('print_count')
        .eq('id', id)
        .maybeSingle(),
      'load the prescription',
    ) as { print_count: number | null } | null;
    if (!rx)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Prescription not found.',
      });

    const current = toNumber(rx.print_count);
    const updated = unwrapList(
      await this.db
        .from('prescriptions')
        .update({
          print_count: current + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('print_count', current)
        .select('id'),
      'record the reprint',
    );
    if (updated.length === 0) {
      throw new ConflictException({
        code: 'STOCK_CHANGED',
        message: 'The prescription changed at the same time. Please try again.',
      });
    }

    unwrap(
      await this.db.from('prescription_events').insert({
        prescription_id: id,
        event_type: 'REPRINTED',
        user_id: userId,
        metadata: { reason: reason.trim(), printCount: current + 1 },
      }),
      'record the reprint event',
    );
    return { success: true, newPrintCount: current + 1 };
  }

  async getProducts(query?: string, category?: string, stockStatus?: string) {
    let list = unwrapList(
      await this.db
        .from('products')
        .select('*')
        .order('name', { ascending: true }),
      'load products',
    );
    const term = query?.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (p: Row) =>
          p.name?.toLowerCase().includes(term) ||
          p.generic_name?.toLowerCase().includes(term) ||
          p.barcode?.includes(term),
      );
    }
    if (category && category !== 'ALL')
      list = list.filter((p: Row) => p.category === category);
    if (stockStatus === 'low')
      list = list.filter((p: Row) =>
        ['LOW', 'CRITICAL'].includes(stockLevel(p)),
      );
    else if (stockStatus === 'out')
      list = list.filter((p: Row) => stockLevel(p) === 'OUT_OF_STOCK');
    return list.map((p: Row) => ({ ...p, stock_level: stockLevel(p) }));
  }

  async getProductById(id: string) {
    const [productRes, batchesRes] = await Promise.all([
      this.db.from('products').select('*').eq('id', id).maybeSingle(),
      this.db
        .from('product_batches')
        .select('*, suppliers(name)')
        .eq('product_id', id)
        .order('expiry_date', { ascending: true, nullsFirst: false }),
    ]);
    const product = unwrapRequired(productRes, 'load the product');
    return {
      product: { ...product, stock_level: stockLevel(product) },
      batches: unwrapList(batchesRes, "load the product's batches"),
      movements: await this.getProductMovements(id),
    };
  }

  async getInventoryDashboard() {
    const [products, batchesRes] = await Promise.all([
      this.getProducts(),
      this.db
        .from('product_batches')
        .select('product_id, quantity_available, expiry_date'),
    ]);
    const batches = unwrapList(batchesRes, 'load batches');
    const expiringIds = productsExpiringWithin(
      products,
      batches,
      zonedDate(this.timeZone),
      30,
    );

    const outOfStock = products.filter(
      (p: Row) => p.stock_level === 'OUT_OF_STOCK',
    );
    const lowStock = products.filter(
      (p: Row) => p.stock_level === 'LOW' || p.stock_level === 'CRITICAL',
    );
    const expiringSoon = products.filter((p: Row) => expiringIds.has(p.id));
    return {
      metrics: {
        totalItems: products.length,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
        expiringCount: expiringSoon.length,
      },
      outOfStock,
      lowStock,
      expiringSoon,
      allProducts: products,
    };
  }

  async getLabelLogs(limit = 20) {
    return unwrapList(
      await this.db
        .from('prescription_events')
        .select(
          '*, prescriptions(prescription_number, customer_name_text, print_count, prescription_items(count))',
        )
        .in('event_type', ['PRINTED', 'REPRINTED'])
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 200)),
      'load print history',
    );
  }
}
