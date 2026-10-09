import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

const ID = '44444444-4444-4444-8444-444444444444';

function serviceFor(db: FakeSupabase) {
  return new CustomersService({ getClient: () => db.client() } as unknown as SupabaseService);
}

describe('CustomersService', () => {
  const seed = () => new FakeSupabase({ customers: [{ id: ID, name: 'Nimal Perera', phone_number: '0771234567' }] });

  describe('searchByPhone', () => {
    it('requires a search term', async () => {
      await expect(serviceFor(seed()).searchByPhone('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('matches by phone or name from the database', async () => {
      await expect(serviceFor(seed()).searchByPhone('077123')).resolves.toHaveLength(1);
      await expect(serviceFor(seed()).searchByPhone('nimal')).resolves.toHaveLength(1);
    });

    it('returns no one when the database has no match (no built-in patients)', async () => {
      await expect(serviceFor(new FakeSupabase()).searchByPhone('07783939393')).resolves.toEqual([]);
    });

    it('reports a failed query as an error, not an empty result', async () => {
      await expect(serviceFor(seed().fail('customers', 'select')).searchByPhone('077')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('create', () => {
    it('stores the patient and returns the database record', async () => {
      const db = new FakeSupabase();
      const saved = await serviceFor(db).create({ name: ' Kamala ', phone_number: '0712345678', medical_notes: '' });
      expect(saved).toMatchObject({ name: 'Kamala', phone_number: '0712345678' });
      expect(db.table('customers')[0]).not.toHaveProperty('medical_notes');
    });

    it('fails instead of returning a locally invented record when the insert fails', async () => {
      const db = new FakeSupabase().fail('customers', 'insert', { code: 'PGRST204', message: "column 'age' missing" });
      const err = await serviceFor(db)
        .create({ name: 'Kamala', phone_number: '0712345678', age: '40' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err.getResponse()).toMatchObject({ code: 'SCHEMA_OUT_OF_DATE' });
    });
  });

  describe('remove', () => {
    it('deletes an existing patient', async () => {
      const db = seed();
      await expect(serviceFor(db).remove(ID)).resolves.toEqual({ success: true, id: ID });
      expect(db.table('customers')).toHaveLength(0);
    });

    it('returns 404 instead of success when nothing was deleted', async () => {
      await expect(serviceFor(new FakeSupabase()).remove(ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fails when the delete fails', async () => {
      await expect(serviceFor(seed().fail('customers', 'delete')).remove(ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
