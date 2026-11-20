import { BadRequestException, NotFoundException, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { CreateSupplierDto } from './dto/supplier.dto';

const ID = '77777777-7777-4777-8777-777777777777';

function serviceFor(db: FakeSupabase) {
  return new SuppliersService({ getClient: () => db.client() } as unknown as SupabaseService);
}

describe('Supplier request validation (global ValidationPipe)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: CreateSupplierDto });

  it('keeps the submitted fields instead of stripping the body to {}', async () => {
    // Before Phase 1 the DTO had no decorators, so whitelist removed every field (finding D9).
    const result = await validate({ name: 'SPC', phone: '011 234 5678', email: '', notes: 'x', injected: 'drop me' });
    expect(result).toMatchObject({ name: 'SPC', phone: '011 234 5678', email: '', notes: 'x' });
    expect(result).not.toHaveProperty('injected');
  });

  it('rejects a missing name and a malformed email', async () => {
    await expect(validate({ phone: '0112345678' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate({ name: 'SPC', email: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SuppliersService', () => {
  it('creates a supplier, storing blank optional fields as null', async () => {
    const db = new FakeSupabase();
    const saved = await serviceFor(db).create({ name: ' SPC ', email: '', phone: '0112345678' });
    expect(saved).toMatchObject({ name: 'SPC', email: null, phone: '0112345678', active: true });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('fails instead of inventing a supplier when the insert fails', async () => {
    const db = new FakeSupabase().fail('suppliers', 'insert');
    await expect(serviceFor(db).create({ name: 'SPC' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.table('suppliers')).toHaveLength(0);
  });

  it('updates an existing supplier and 404s for an unknown one', async () => {
    const db = new FakeSupabase({ suppliers: [{ id: ID, name: 'Old' }] });
    await expect(serviceFor(db).update(ID, { name: 'New' })).resolves.toMatchObject({ id: ID, name: 'New' });
    await expect(serviceFor(db).update('88888888-8888-4888-8888-888888888888', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an empty update', async () => {
    await expect(serviceFor(new FakeSupabase()).update(ID, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only stored suppliers; an empty table is an empty list', async () => {
    await expect(serviceFor(new FakeSupabase()).findAll()).resolves.toEqual([]);
  });

  it('reports load failures as errors, including on the detail page', async () => {
    await expect(serviceFor(new FakeSupabase().fail('suppliers', 'select')).findAll()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const db = new FakeSupabase({ suppliers: [{ id: ID, name: 'SPC' }] }).fail('stock_receipts', 'select');
    await expect(serviceFor(db).findOne(ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 404 for an unknown supplier', async () => {
    await expect(serviceFor(new FakeSupabase()).findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
