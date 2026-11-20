import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PosService, toCatalogItem } from './pos.service';
import { PosController } from './pos.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { RolesGuard } from '../auth/roles.guard';
import { ALL_ROLES, parseRole, Role, type AuthUser } from '../auth/roles';
import { zonedDate } from '../common/time';

const TODAY = '2026-10-30';
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

function serviceFor(db: FakeSupabase) {
  return new PosService(
    { getClient: () => db.client() } as unknown as SupabaseService,
    { get: () => 'Asia/Colombo' } as unknown as ConfigService,
  );
}

const future = '2099-01-31';

function seed() {
  return new FakeSupabase({
    products: [
      {
        id: P1,
        name: 'Panadol 500mg',
        generic_name: 'Paracetamol',
        barcode: '4791000',
        stock_quantity: 50,
        retail_price: '12.50',
        rx_required: false,
      },
      {
        id: P2,
        name: 'Amoxil 250',
        generic_name: 'Amoxicillin',
        barcode: '4792000',
        stock_quantity: 10,
        retail_price: null,
        rx_required: true,
      },
      {
        id: 'p3',
        name: 'Paracetamol Syrup',
        generic_name: 'Paracetamol',
        barcode: '4793000',
        stock_quantity: 5,
        is_active: false,
      },
    ],
    product_batches: [
      {
        id: 'b1',
        product_id: P1,
        batch_number: 'B-LATE',
        expiry_date: '2099-06-30',
        quantity_available: 20,
        status: 'ACTIVE',
        received_at: '2026-01-01',
      },
      {
        id: 'b2',
        product_id: P1,
        batch_number: 'B-EARLY',
        expiry_date: future,
        quantity_available: 15,
        status: 'ACTIVE',
        received_at: '2026-02-01',
      },
      {
        id: 'b3',
        product_id: P1,
        batch_number: 'B-QUAR',
        expiry_date: future,
        quantity_available: 5,
        status: 'QUARANTINED',
        received_at: '2026-02-01',
      },
      {
        id: 'b4',
        product_id: P1,
        batch_number: 'B-OLD',
        expiry_date: '2020-01-01',
        quantity_available: 10,
        status: 'ACTIVE',
        received_at: '2019-01-01',
      },
      {
        id: 'b5',
        product_id: P2,
        batch_number: 'B-NODATE',
        expiry_date: null,
        quantity_available: 10,
        status: 'ACTIVE',
        received_at: '2026-01-01',
      },
    ],
  });
}

describe('PosService.searchCatalog', () => {
  it('requires a search term or a barcode', async () => {
    await expect(
      serviceFor(seed()).searchCatalog({ q: '  ' }, false),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('matches the generic name as well as the brand name, excluding inactive medicines', async () => {
    const result = await serviceFor(seed()).searchCatalog(
      { q: 'paracet' },
      false,
    );
    expect(result.map((p) => p.name)).toEqual(['Panadol 500mg']);
  });

  it('finds a medicine by exact barcode', async () => {
    const result = await serviceFor(seed()).searchCatalog(
      { barcode: '4792000' },
      false,
    );
    expect(result.map((p) => p.id)).toEqual([P2]);
  });

  it('returns an empty list for an unknown barcode', async () => {
    await expect(
      serviceFor(seed()).searchCatalog({ barcode: '000' }, false),
    ).resolves.toEqual([]);
  });

  it('counts only eligible batches as sellable and reports the recorded price without defaulting', async () => {
    const [panadol] = await serviceFor(seed()).searchCatalog(
      { barcode: '4791000' },
      false,
    );
    // 20 + 15 eligible; quarantined (5) and expired (10) excluded.
    expect(panadol).toMatchObject({
      price: 12.5,
      recordedStock: 50,
      sellableQuantity: 35,
      nearestExpiry: future,
    });
    expect(panadol.batches).toBeUndefined();

    const [amoxil] = await serviceFor(seed()).searchCatalog(
      { barcode: '4792000' },
      false,
    );
    // Undated batch is never sellable; no price recorded stays null.
    expect(amoxil).toMatchObject({
      price: null,
      sellableQuantity: 0,
      nearestExpiry: null,
      rxRequired: true,
    });
  });

  it('shows eligible batches earliest-expiry first to stock managers only', async () => {
    const [panadol] = await serviceFor(seed()).searchCatalog(
      { barcode: '4791000' },
      true,
    );
    expect(panadol.batches?.map((b) => b.batchNumber)).toEqual([
      'B-EARLY',
      'B-LATE',
    ]);
  });

  it('reports a database failure as an error, never as an empty catalogue', async () => {
    await expect(
      serviceFor(seed().fail('products', 'select')).searchCatalog(
        { q: 'pan' },
        false,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      serviceFor(seed().fail('product_batches', 'select')).searchCatalog(
        { q: 'pan' },
        false,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('toCatalogItem (sellable stock rule D-08)', () => {
  const product = {
    id: 'p',
    name: 'X',
    stock_quantity: 30,
    retail_price: 5,
    expiry_date: '2099-12-31',
  };

  it('adds units recorded without a batch only when the medicine expiry is known and valid', () => {
    const batches = [
      {
        id: 'b',
        product_id: 'p',
        expiry_date: '2099-01-01',
        quantity_available: 10,
        status: 'ACTIVE',
      },
    ];
    expect(toCatalogItem(product, batches, TODAY, false).sellableQuantity).toBe(
      30,
    );
    expect(
      toCatalogItem({ ...product, expiry_date: null }, batches, TODAY, false)
        .sellableQuantity,
    ).toBe(10);
    expect(
      toCatalogItem(
        { ...product, expiry_date: '2020-01-01' },
        batches,
        TODAY,
        false,
      ).sellableQuantity,
    ).toBe(10);
  });

  it('never reports more than the product total when batch records exceed it', () => {
    const batches = [
      {
        id: 'b',
        product_id: 'p',
        expiry_date: '2099-01-01',
        quantity_available: 40,
        status: 'ACTIVE',
      },
    ];
    expect(toCatalogItem(product, batches, TODAY, false).sellableQuantity).toBe(
      30,
    );
  });

  it('treats a batch expiring today as sellable and one that expired yesterday as not', () => {
    const p = { ...product, stock_quantity: 2, expiry_date: null };
    const batches = [
      {
        id: 'a',
        product_id: 'p',
        expiry_date: TODAY,
        quantity_available: 1,
        status: 'ACTIVE',
      },
      {
        id: 'b',
        product_id: 'p',
        expiry_date: '2026-10-29',
        quantity_available: 1,
        status: 'ACTIVE',
      },
    ];
    expect(toCatalogItem(p, batches, TODAY, false)).toMatchObject({
      sellableQuantity: 1,
      nearestExpiry: TODAY,
    });
  });

  it('rejects a negative or non-numeric price as missing', () => {
    expect(
      toCatalogItem({ ...product, retail_price: -1 }, [], TODAY, false).price,
    ).toBeNull();
    expect(
      toCatalogItem({ ...product, retail_price: 'abc' }, [], TODAY, false)
        .price,
    ).toBeNull();
    expect(
      toCatalogItem({ ...product, retail_price: 0 }, [], TODAY, false).price,
    ).toBe(0);
  });
});

describe('POS roles', () => {
  const guard = new RolesGuard(new Reflector());
  function ctx(
    role: Role | null,
    handler: (...args: any[]) => any,
  ): ExecutionContext {
    const user: AuthUser = { id: 'u', email: null, role };
    return {
      getHandler: () => handler,
      getClass: () => PosController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('recognises the cashier role but keeps it out of the pharmacy staff roles', () => {
    expect(parseRole('cashier')).toBe(Role.Cashier);
    expect(ALL_ROLES).not.toContain(Role.Cashier);
  });

  it('admits every POS role to the catalogue and refuses an account without a role', () => {
    const handler = Object.getOwnPropertyDescriptor(
      PosController.prototype,
      'catalog',
    )?.value as (...args: unknown[]) => unknown;
    for (const role of [
      Role.Admin,
      Role.Pharmacist,
      Role.Staff,
      Role.Cashier,
    ]) {
      expect(guard.canActivate(ctx(role, handler))).toBe(true);
    }
    expect(() => guard.canActivate(ctx(null, handler))).toThrow(
      ForbiddenException,
    );
  });

  it('shows batches to stock managers and hides them from cashiers and staff', async () => {
    const calls: boolean[] = [];
    const controller = new PosController({
      searchCatalog: (_q: unknown, includeBatches: boolean) => {
        calls.push(includeBatches);
        return Promise.resolve([]);
      },
    } as unknown as PosService);
    for (const role of [
      Role.Admin,
      Role.Pharmacist,
      Role.Staff,
      Role.Cashier,
    ]) {
      await controller.catalog({ q: 'x' }, { id: 'u', email: null, role });
    }
    expect(calls).toEqual([true, true, false, false]);
  });

  it('uses the pharmacy calendar date', () => {
    expect(zonedDate('Asia/Colombo')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('PosService.lookupCustomers (minimal patient lookup)', () => {
  const patients = () =>
    new FakeSupabase({
      customers: [
        {
          id: 'c1',
          name: 'Test Patient A',
          phone_number: '0771234567',
          address: '1 Example Road',
          allergies: 'Penicillin',
          medical_notes: 'Synthetic note',
          created_at: '2026-01-05T10:00:00Z',
        },
        {
          id: 'c2',
          name: 'Test Patient B',
          phone_number: '0771234567',
          created_at: '2026-03-01T10:00:00Z',
        },
        { id: 'c3', name: 'Other Person', phone_number: '0719999999' },
      ],
    });

  it('refuses a lookup with fewer than 7 digits, so patients cannot be listed', async () => {
    for (const phone of ['', '077', '077-12', 'abcdefghij']) {
      await expect(
        serviceFor(patients()).lookupCustomers(phone),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('returns only name, last four digits and registration date, never clinical or contact details', async () => {
    const result = await serviceFor(patients()).lookupCustomers('077 123 4567');
    expect(result).toEqual([
      {
        id: 'c1',
        name: 'Test Patient A',
        phoneLast4: '4567',
        registeredOn: '2026-01-05',
      },
      {
        id: 'c2',
        name: 'Test Patient B',
        phoneLast4: '4567',
        registeredOn: '2026-03-01',
      },
    ]);
    const text = JSON.stringify(result);
    for (const leaked of [
      'Example Road',
      'Penicillin',
      'Synthetic note',
      '0771234567',
    ]) {
      expect(text).not.toContain(leaked);
    }
  });

  it('returns an empty list when no patient matches', async () => {
    await expect(
      serviceFor(patients()).lookupCustomers('0700000000'),
    ).resolves.toEqual([]);
  });

  it('reports a database failure as an error, not as no patients', async () => {
    await expect(
      serviceFor(patients().fail('customers', 'select')).lookupCustomers(
        '0771234567',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('PosService.searchCatalog by ids (cart recheck)', () => {
  it('returns the current price and sellable stock of the listed medicines, skipping inactive ones', async () => {
    const result = await serviceFor(seed()).searchCatalog(
      { ids: `${P1},${P2},p3` },
      false,
    );
    expect(result.map((p) => [p.id, p.price, p.sellableQuantity])).toEqual([
      [P1, 12.5, 35],
      [P2, null, 0],
    ]);
  });
});
