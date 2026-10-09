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
