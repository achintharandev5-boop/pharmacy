import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { likeTerm, unwrapList, unwrapRequired } from '../common/db';

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
    product_type: row.product_type ?? row.dosage_form ?? null,
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
}
