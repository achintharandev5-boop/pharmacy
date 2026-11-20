import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { likeTerm, unwrap, unwrapList, unwrapRequired } from '../common/db';
import { CreateSupplierDto, SUPPLIER_FIELDS, UpdateSupplierDto } from './dto/supplier.dto';

/** Builds a row from whitelisted fields only; blank optional strings become null. */
function toRow(dto: CreateSupplierDto | UpdateSupplierDto): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of SUPPLIER_FIELDS) {
    const value = dto[field];
    if (value === undefined) continue;
    row[field] = typeof value === 'string' ? value.trim() || null : value;
  }
  return row;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  async findAll(query?: string) {
    let q = this.db.from('suppliers').select('*').order('name', { ascending: true });
    const term = likeTerm(query ?? '');
    if (term) q = q.or(`name.ilike.%${term}%,contact_person.ilike.%${term}%,phone.ilike.%${term}%`);
    return unwrapList(await q, 'load suppliers');
  }

  async findOne(id: string) {
    const [supplier, batches, receipts] = await Promise.all([
      this.db.from('suppliers').select('*').eq('id', id).maybeSingle(),
      this.db
        .from('product_batches')
        .select('*, products(name, barcode)')
        .eq('supplier_id', id)
        .order('created_at', { ascending: false }),
      this.db.from('stock_receipts').select('*').eq('supplier_id', id).order('created_at', { ascending: false }),
    ]);

    return {
      supplier: unwrapRequired(supplier, 'load the supplier'),
      suppliedBatches: unwrapList(batches, "load the supplier's batches"),
      receipts: unwrapList(receipts, "load the supplier's receipts"),
    };
  }

  async create(dto: CreateSupplierDto) {
    const row = toRow(dto);
    if (row.active === undefined) row.active = true;
    return unwrapRequired<Record<string, unknown>>(await this.db.from('suppliers').insert(row).select().single(), 'save the supplier');
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const row = toRow(dto);
    if (Object.keys(row).length === 0) throw new BadRequestException('No supplier fields to update');
    if ('name' in row && !row.name) throw new BadRequestException('Supplier name cannot be empty');

    const updated = unwrap<Record<string, unknown>>(
      await this.db
        .from('suppliers')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle(),
      'update the supplier',
    );
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Supplier not found.' });
    return updated;
  }
}
