import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { likeTerm, toHttpError, unwrap, unwrapList, unwrapRequired } from '../common/db';
import { CreateProductDto, PRODUCT_FIELDS, UpdateProductDto } from './dto/product.dto';

/** Fields the label workstation needs. Taken from the product row; missing columns become null. */
export interface ProductSummary {
  id: string;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  barcode: string | null;
  stock_quantity: number | null;
  expiry_date: string | null;
  batch_number: string | null;
  retail_price: number | null;
  pack_size: number | null;
  product_type: string | null;
  is_active: boolean;
}

const SEARCH_LIMIT = 25;

function toSummary(row: Record<string, any>): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    generic_name: row.generic_name ?? null,
    brand_name: row.brand_name ?? null,
    strength: row.strength ?? null,
    dosage_form: row.dosage_form ?? null,
    barcode: row.barcode ?? null,
    stock_quantity: row.stock_quantity ?? null,
    expiry_date: row.expiry_date ?? null,
    batch_number: row.batch_number ?? null,
    retail_price: row.retail_price ?? null,
    pack_size: row.pack_size ?? null,
    product_type: row.product_type ?? null,
    is_active: row.is_active !== false,
  };
}

/**
 * Medicine lookup for the label workstation. Results come only from the database; a database
 * error is reported as an error, never as "no results".
 *
 * `select('*')` is used deliberately so the service works with both the original and the
 * extended product schema.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async searchByName(q: string): Promise<ProductSummary[]> {
    const term = likeTerm(q ?? '');
    if (!term) throw new BadRequestException('Search query "q" is required');

    const rows = unwrapList(
      await this.supabaseService
        .getClient()
        .from('products')
        .select('*')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(SEARCH_LIMIT),
      'search medicines',
    );
    return rows.map(toSummary).filter((p) => p.is_active);
  }

  async findByBarcode(barcode: string): Promise<ProductSummary> {
    const row = unwrapRequired<Record<string, any>>(
      await this.supabaseService.getClient().from('products').select('*').eq('barcode', barcode.trim()).maybeSingle(),
      'look up the barcode',
    );
    return toSummary(row);
  }

  async findById(id: string): Promise<ProductSummary> {
    const row = unwrapRequired<Record<string, any>>(
      await this.supabaseService.getClient().from('products').select('*').eq('id', id).maybeSingle(),
      'load the medicine',
    );
    return toSummary(row);
  }

  async create(dto: CreateProductDto) {
    const row = productRow(dto);
    checkThresholds(row);
    const { data, error } = await this.supabaseService.getClient().from('products').insert(row).select('*').single();
    if (error) throw productWriteError(error, 'save the medicine');
    return data;
  }

  async update(id: string, dto: UpdateProductDto) {
    const row = productRow(dto);
    if (Object.keys(row).length === 0) throw new BadRequestException('No medicine fields to update');
    if ('name' in row && !row.name) throw new BadRequestException('Medicine name cannot be empty');

    const current = unwrapRequired<Record<string, any>>(
      await this.supabaseService.getClient().from('products').select('*').eq('id', id).maybeSingle(),
      'load the medicine',
    );
    checkThresholds({ ...current, ...row });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('products')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw productWriteError(error, 'update the medicine');
    if (!data) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Medicine not found.' });
    return data;
  }
}

/** Whitelisted catalogue fields; blank strings become null. */
function productRow(dto: CreateProductDto | UpdateProductDto): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of PRODUCT_FIELDS) {
    const value = (dto as Record<string, unknown>)[field];
    if (value === undefined) continue;
    row[field] = typeof value === 'string' ? value.trim() || null : value;
  }
  return row;
}

function checkThresholds(p: Record<string, any>) {
  const min = p.minimum_stock ?? null;
  const reorder = p.reorder_level ?? null;
  const max = p.maximum_stock ?? null;
  if (min !== null && reorder !== null && reorder < min) {
    throw new BadRequestException({ code: 'INVALID_THRESHOLDS', message: 'Reorder level cannot be below the minimum stock level.' });
  }
  if (max !== null && reorder !== null && max < reorder) {
    throw new BadRequestException({ code: 'INVALID_THRESHOLDS', message: 'Maximum stock cannot be below the reorder level.' });
  }
}

function productWriteError(error: { code?: string; message?: string }, operation: string) {
  if (error.code === '23502') {
    // The original schema requires expiry_date and batch_number on every product. Inventing
    // them is not acceptable; migration 20261010000100 removes that requirement.
    return new ServiceUnavailableException({
      code: 'SCHEMA_OUT_OF_DATE',
      message: `Could not ${operation}: the database still requires an expiry date and batch number on the medicine record. Apply database migration 20261010000100.`,
    });
  }
  if (error.code === 'PGRST204') {
    // A column such as unit_of_measure or pack_size is added by migration 20261010000100.
    return new ServiceUnavailableException({
      code: 'SCHEMA_OUT_OF_DATE',
      message: `Could not ${operation}: the database is missing medicine columns. Apply database migration 20261010000100.`,
    });
  }
  if (error.code === '23505') {
    return new BadRequestException({ code: 'DUPLICATE_BARCODE', message: 'Another medicine already has this barcode.' });
  }
  return toHttpError(error, operation);
}
