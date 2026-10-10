import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

const ID = '11111111-1111-4111-8111-111111111111';

function serviceFor(db: FakeSupabase) {
  return new ProductsService({ getClient: () => db.client() } as unknown as SupabaseService);
}

describe('ProductsService', () => {
  const seed = () =>
    new FakeSupabase({
      products: [
        { id: ID, name: 'Panadol 500mg', barcode: '479100010001', stock_quantity: 40, expiry_date: '2028-12-31' },
        { id: 'p2', name: 'Panadol Syrup', barcode: '2', stock_quantity: 0, is_active: false },
        { id: 'p3', name: 'Amoxicillin', barcode: '3', stock_quantity: 5 },
      ],
    });

  it('requires a search term', async () => {
    await expect(serviceFor(seed()).searchByName('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only database matches, excluding inactive products', async () => {
    const result = await serviceFor(seed()).searchByName('pana');
    expect(result.map((p) => p.name)).toEqual(['Panadol 500mg']);
    expect(result[0]).toMatchObject({ id: ID, stock_quantity: 40, expiry_date: '2028-12-31', strength: null });
  });

  it('returns an empty list when nothing matches', async () => {
    await expect(serviceFor(seed()).searchByName('NonExistent')).resolves.toEqual([]);
  });

  it('reports a database failure as an error, not as no results', async () => {
    await expect(serviceFor(seed().fail('products', 'select')).searchByName('pana')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('finds a product by barcode', async () => {
    await expect(serviceFor(seed()).findByBarcode('479100010001')).resolves.toMatchObject({ id: ID });
  });

  it('returns 404 for an unknown barcode or id', async () => {
    await expect(serviceFor(seed()).findByBarcode('999')).rejects.toBeInstanceOf(NotFoundException);
    await expect(serviceFor(seed()).findById('99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not answer "not found" when the lookup itself failed', async () => {
    await expect(serviceFor(seed().fail('products', 'select')).findById(ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('ProductsService create/update', () => {
  it('creates a catalogue entry without any stock, batch or expiry value', async () => {
    const db = new FakeSupabase();
    await serviceFor(db).create({ name: ' Panadol 500mg ', barcode: 'P-500', reorder_level: 20, minimum_stock: 5 });
    const row = db.table('products')[0];
    expect(row).toMatchObject({ name: 'Panadol 500mg', barcode: 'P-500', reorder_level: 20 });
    expect(row).not.toHaveProperty('stock_quantity');
    expect(row).not.toHaveProperty('expiry_date');
  });

  it('explains a schema that still demands an expiry date instead of inventing one', async () => {
    const db = new FakeSupabase().fail('products', 'insert', { code: '23502', message: 'null value in column "expiry_date"' });
    const err = await serviceFor(db).create({ name: 'X', barcode: 'X1' }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getResponse()).toMatchObject({ code: 'SCHEMA_OUT_OF_DATE' });
  });

  it('explains a schema that lacks the new medicine columns', async () => {
    const db = new FakeSupabase().fail('products', 'insert', { code: 'PGRST204', message: "Could not find the 'pack_size' column" });
    const err = await serviceFor(db).create({ name: 'X', barcode: 'X1', pack_size: 10 }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getResponse()).toMatchObject({ code: 'SCHEMA_OUT_OF_DATE' });
  });

  it('reports a duplicate barcode', async () => {
    const db = new FakeSupabase().fail('products', 'insert', { code: '23505', message: 'duplicate' });
    await expect(serviceFor(db).create({ name: 'X', barcode: 'X1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inconsistent stock thresholds, including against stored values', async () => {
    const db = new FakeSupabase({ products: [{ id: ID, name: 'A', barcode: 'A', minimum_stock: 10 }] });
    await expect(serviceFor(db).update(ID, { reorder_level: 5 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(serviceFor(db).update(ID, { reorder_level: 15 })).resolves.toMatchObject({ reorder_level: 15 });
  });

  it('returns 404 when updating an unknown medicine', async () => {
    await expect(serviceFor(new FakeSupabase()).update(ID, { name: 'B' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
