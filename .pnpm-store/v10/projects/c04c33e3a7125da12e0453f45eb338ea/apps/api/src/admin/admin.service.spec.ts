import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

const RX = '66666666-6666-4666-8666-666666666666';
const USER = '55555555-5555-4555-8555-555555555555';

function serviceFor(db: FakeSupabase) {
  return new AdminService(
    { getClient: () => db.client() } as unknown as SupabaseService,
    { get: () => 'Asia/Colombo' } as unknown as ConfigService,
  );
}

describe('AdminService dashboard', () => {
  it('reports real zeros for an empty pharmacy, never placeholder figures', async () => {
    const s = await serviceFor(new FakeSupabase()).getSummary();
    expect(s.today).toEqual({
      prescriptions: 0,
      labelsPrinted: 0,
      printJobs: 0,
      registeredPatients: 0,
      walkInPrescriptions: 0,
      itemsDispensed: 0,
      inventoryMovements: 0,
    });
    expect(s.totalPatients).toBe(0);
    expect(s.inventory).toEqual({
      lowStock: 0,
      outOfStock: 0,
      noThreshold: 0,
      expiring30Days: 0,
    });
    expect(s).not.toHaveProperty('today.prescriptionsComparison');
  });

  it('fails instead of showing zeros when a query fails', async () => {
    await expect(
      serviceFor(
        new FakeSupabase().fail('prescriptions', 'select'),
      ).getSummary(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('counts today’s prescriptions in pharmacy time', async () => {
    const now = new Date().toISOString();
    const db = new FakeSupabase({
      prescriptions: [
        {
          id: 'a',
          customer_id: 'c1',
          created_at: now,
          prescription_items: [{ quantity: 10 }, { quantity: 5 }],
        },
        {
          id: 'b',
          customer_id: null,
          created_at: now,
          prescription_items: [{ quantity: 1 }],
        },
        {
          id: 'old',
          customer_id: 'c1',
          created_at: '2020-01-01T00:00:00Z',
          prescription_items: [{ quantity: 99 }],
        },
      ],
    });
    const s = await serviceFor(db).getSummary();
    expect(s.today).toMatchObject({
      prescriptions: 2,
      itemsDispensed: 16,
      registeredPatients: 1,
      walkInPrescriptions: 1,
    });
  });

  it('counts total patients and today’s ledger movements from database records', async () => {
    const now = new Date().toISOString();
    const db = new FakeSupabase({
      customers: [{ id: 'p1' }, { id: 'p2' }],
      inventory_movements: [
        { id: 'm1', created_at: now },
        { id: 'm2', created_at: now },
        { id: 'old', created_at: '2020-01-01T00:00:00Z' },
      ],
    });
    const summary = await serviceFor(db).getSummary();
    expect(summary.totalPatients).toBe(2);
    expect(summary.today.inventoryMovements).toBe(2);
    expect(db.calls.filter((call) => call.table === 'customers')).toHaveLength(
      1,
    );
  });

  it('surfaces patient and movement count database failures', async () => {
    await expect(
      serviceFor(new FakeSupabase().fail('customers', 'select')).getSummary(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      serviceFor(
        new FakeSupabase().fail('inventory_movements', 'select'),
      ).getSummary(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects unsupported dashboard date ranges instead of silently changing them', async () => {
    await expect(
      serviceFor(new FakeSupabase()).getActivity('365d'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a zero-filled day series without random values', async () => {
    const a = await serviceFor(new FakeSupabase()).getActivity('7d');
    expect(a).toHaveLength(7);
    expect(
      a.every((d) => d.prescriptions === 0 && d.labels === 0 && d.items === 0),
    ).toBe(true);
    const b = await serviceFor(new FakeSupabase()).getActivity('7d');
    expect(b).toEqual(a);
  });

  it('bounds dashboard activity to the selected range and excludes future records', async () => {
    const db = new FakeSupabase({
      prescriptions: [
        {
          created_at: new Date().toISOString(),
          prescription_items: [{ quantity: 2 }],
        },
        {
          created_at: '2099-01-01T00:00:00Z',
          prescription_items: [{ quantity: 7 }],
        },
        {
          created_at: '2020-01-01T00:00:00Z',
          prescription_items: [{ quantity: 9 }],
        },
      ],
    });
    const rows = await serviceFor(db).getActivity('7d');
    expect(rows.reduce((sum, row) => sum + row.prescriptions, 0)).toBe(1);
    expect(rows.reduce((sum, row) => sum + row.items, 0)).toBe(2);
  });

  it('derives status and time-of-day breakdowns from records', async () => {
    const db = new FakeSupabase({
      prescriptions: [
        { status: 'COMPLETED', created_at: new Date().toISOString() },
        { status: 'COMPLETED', created_at: new Date().toISOString() },
      ],
    });
    const b = await serviceFor(db).getStatusBreakdown();
    expect(b.total).toBe(2);
    expect(b.status).toEqual([{ name: 'COMPLETED', value: 2 }]);
    expect(b.timeOfDay.reduce((s, p) => s + p.count, 0)).toBe(2);
  });

  it('raises no alerts for a healthy inventory', async () => {
    const db = new FakeSupabase({
      products: [{ id: 'a', name: 'A', stock_quantity: 50, reorder_level: 10 }],
    });
    await expect(serviceFor(db).getAlerts()).resolves.toEqual([]);
  });

  it('reports database health from a real query', async () => {
    await expect(
      serviceFor(new FakeSupabase()).getHealth(),
    ).resolves.toMatchObject({ database: { status: 'ok' } });
    await expect(
      serviceFor(new FakeSupabase().fail('products', 'select')).getHealth(),
    ).resolves.toMatchObject({
      database: { status: 'error' },
    });
  });
});

describe('AdminService records', () => {
  it('returns 404 for an unknown patient instead of an invented profile', async () => {
    await expect(
      serviceFor(new FakeSupabase()).getPatientProfile(RX),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for an unknown prescription instead of a sample', async () => {
    await expect(
      serviceFor(new FakeSupabase()).getPrescriptionById(RX),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty prescription list rather than samples', async () => {
    await expect(
      serviceFor(new FakeSupabase()).getPrescriptions(),
    ).resolves.toEqual([]);
  });

  it('records a reprint with its reason and user, and fails if it cannot', async () => {
    const db = new FakeSupabase({
      prescriptions: [{ id: RX, print_count: 1 }],
    });
    await expect(
      serviceFor(db).reprintPrescriptionLabel(RX, 'Label smudged', USER),
    ).resolves.toEqual({
      success: true,
      newPrintCount: 2,
    });
    expect(db.table('prescription_events')[0]).toMatchObject({
      event_type: 'REPRINTED',
      user_id: USER,
      metadata: { reason: 'Label smudged', printCount: 2 },
    });

    const failing = new FakeSupabase({
      prescriptions: [{ id: RX, print_count: 1 }],
    }).fail('prescription_events', 'insert');
    await expect(
      serviceFor(failing).reprintPrescriptionLabel(RX, 'x', USER),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      serviceFor(db).reprintPrescriptionLabel(RX, ' ', USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
