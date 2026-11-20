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

  describe('list', () => {
    const many = () =>
      new FakeSupabase({
        customers: Array.from({ length: 30 }, (_, i) => ({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          name: `Patient ${String(i).padStart(2, '0')}`,
          phone_number: `07700000${String(i).padStart(2, '0')}`,
        })),
      });

    it('returns one page with the total, never the whole table', async () => {
      const result = await serviceFor(many()).list({ page: 2, pageSize: 10 });
      expect(result).toMatchObject({ total: 30, page: 2, pageSize: 10 });
      expect(result.items.map((p) => p.name)).toEqual(Array.from({ length: 10 }, (_, i) => `Patient ${10 + i}`));
    });

    it('defaults to the first page of 25', async () => {
      const result = await serviceFor(many()).list();
      expect(result).toMatchObject({ total: 30, page: 1, pageSize: 25 });
      expect(result.items).toHaveLength(25);
    });

    it('filters by name or mobile number and counts only the matches', async () => {
      await expect(serviceFor(many()).list({ q: 'patient 2' })).resolves.toMatchObject({ total: 10 });
      const byPhone = await serviceFor(many()).list({ q: '0770000005' });
      expect(byPhone.total).toBe(1);
      expect(byPhone.items[0]).toMatchObject({ name: 'Patient 05' });
    });

    it('returns an empty page past the end', async () => {
      await expect(serviceFor(many()).list({ page: 9, pageSize: 10 })).resolves.toMatchObject({ items: [], total: 30 });
    });

    it('reports a failed count or page as an error, not an empty register', async () => {
      await expect(serviceFor(many().fail('customers', 'select', undefined, 1)).list()).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(serviceFor(many().fail('customers', 'select', undefined, 2)).list()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('findDuplicates', () => {
    const OTHER = '55555555-5555-4555-8555-555555555555';
    const family = () =>
      new FakeSupabase({
        customers: [
          { id: ID, name: 'Nimal Perera', phone_number: '077 123 4567' },
          { id: OTHER, name: 'Kumari Perera', phone_number: '+94771234567' },
          { id: '66666666-6666-4666-8666-666666666666', name: 'Someone Else', phone_number: '0771234568' },
        ],
      });

    it('finds the same number however it was typed', async () => {
      const found = await serviceFor(family()).findDuplicates('077-123-4567');
      expect(found.map((p) => p.name)).toEqual(['Kumari Perera', 'Nimal Perera']);
    });

    it('ignores the record being edited', async () => {
      const found = await serviceFor(family()).findDuplicates('0771234567', ID);
      expect(found.map((p) => p.id)).toEqual([OTHER]);
    });

    it('rejects a number too short to compare', async () => {
      await expect(serviceFor(family()).findDuplicates('12-34')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reports a failed lookup as an error, not "no duplicates"', async () => {
      await expect(serviceFor(family().fail('customers', 'select')).findDuplicates('0771234567')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('update', () => {
    const patient = () =>
      new FakeSupabase({
        customers: [
          {
            id: ID,
            name: 'Nimal Perera',
            phone_number: '0771234567',
            address: 'Colombo',
            allergy_status: 'UNKNOWN',
            allergies: null,
          },
        ],
      });

    it('changes only the fields sent and returns the saved record', async () => {
      const db = patient();
      const saved = await serviceFor(db).update(ID, { name: ' Nimal K. Perera ', age: '45' });
      expect(saved).toMatchObject({ name: 'Nimal K. Perera', age: '45', phone_number: '0771234567', address: 'Colombo' });
      expect(db.table('customers')[0]).toMatchObject({ name: 'Nimal K. Perera', age: '45', address: 'Colombo' });
    });

    it('clears an optional field sent as an empty string', async () => {
      const db = patient();
      await serviceFor(db).update(ID, { address: '  ' });
      expect(db.table('customers')[0].address).toBeNull();
    });

    it('records when the allergy status changed', async () => {
      const db = patient();
      await serviceFor(db).update(ID, { allergy_status: 'HAS_ALLERGIES', allergies: 'Penicillin' });
      expect(db.table('customers')[0]).toMatchObject({ allergy_status: 'HAS_ALLERGIES', allergies: 'Penicillin' });
      expect(db.table('customers')[0].allergy_status_updated_at).toEqual(expect.any(String));
    });

    it('refuses "has allergies" without listing them, before writing', async () => {
      const db = patient();
      const err = await serviceFor(db)
        .update(ID, { allergy_status: 'HAS_ALLERGIES' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ code: 'ALLERGIES_REQUIRED' });
      expect(db.calls.filter((c) => c.op === 'update')).toHaveLength(0);
    });

    it('refuses clearing the allergy list while the status is still "has allergies"', async () => {
      const db = new FakeSupabase({
        customers: [{ id: ID, name: 'A', phone_number: '0771234567', allergy_status: 'HAS_ALLERGIES', allergies: 'Sulfa' }],
      });
      await expect(serviceFor(db).update(ID, { allergies: '' })).rejects.toBeInstanceOf(BadRequestException);
      expect(db.table('customers')[0].allergies).toBe('Sulfa');
    });

    it('does not write when nothing changed', async () => {
      const db = patient();
      await expect(serviceFor(db).update(ID, { name: 'Nimal Perera', allergy_status: 'UNKNOWN' })).resolves.toMatchObject({ id: ID });
      expect(db.calls.filter((c) => c.op === 'update')).toHaveLength(0);
    });

    it('returns 404 for an unknown patient', async () => {
      await expect(serviceFor(new FakeSupabase()).update(ID, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fails when the update fails, without claiming success', async () => {
      await expect(serviceFor(patient().fail('customers', 'update')).update(ID, { name: 'X' })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
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
