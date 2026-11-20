import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

const ID = '11111111-1111-4111-8111-111111111111';
const serviceFor = (db: FakeSupabase) =>
  new ProductsService({
    getClient: () => db.client(),
  } as unknown as SupabaseService);

describe('catalogue product type', () => {
  it.each(['Pethi', 'Karal', 'Packet'])(
    'keeps %s in search, barcode and ID lookup',
    async (product_type) => {
      const service = serviceFor(
        new FakeSupabase({
          products: [
            { id: ID, name: 'Medicine', barcode: 'ABC', product_type },
          ],
        }),
      );
      expect(await service.searchByName('Medicine')).toEqual([
        expect.objectContaining({ product_type }),
      ]);
      expect(await service.findByBarcode('ABC')).toMatchObject({
        product_type,
      });
      expect(await service.findById(ID)).toMatchObject({ product_type });
    },
  );

  it.each([undefined, null, '', 'Unsupported'])(
    'preserves %s without inferring product type from dosage form',
    async (product_type) => {
      const service = serviceFor(
        new FakeSupabase({
          products: [
            {
              id: ID,
              name: 'Medicine',
              barcode: 'ABC',
              dosage_form: 'Pethi',
              product_type,
            },
          ],
        }),
      );
      expect(await service.findById(ID)).toMatchObject({
        product_type: product_type ?? null,
      });
    },
  );

  it('accepts product_type through DTO whitelisting and persists create/update', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Medicine',
      barcode: 'ABC',
      product_type: 'Karal',
    });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.product_type).toBe('Karal');
    const db = new FakeSupabase();
    const service = serviceFor(db);
    await service.create(dto);
    expect(db.table('products')[0]).toMatchObject({ product_type: 'Karal' });

    const existingDb = new FakeSupabase({
      products: [{ id: ID, name: 'Medicine', product_type: 'Karal' }],
    });
    const update = plainToInstance(UpdateProductDto, {
      product_type: 'Packet',
    });
    expect(await validate(update, { whitelist: true })).toEqual([]);
    await serviceFor(existingDb).update(ID, update);
    expect(existingDb.table('products')[0]).toMatchObject({
      product_type: 'Packet',
    });
    await serviceFor(existingDb).update(ID, { name: 'Edited medicine' });
    expect(existingDb.table('products')[0]).toMatchObject({
      product_type: 'Packet',
    });
  });
});
