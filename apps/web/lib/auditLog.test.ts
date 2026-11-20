import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  actionLabel,
  actorLabel,
  filtersFromParams,
  moduleLabel,
  recordHref,
  recordLabel,
  shortId,
  validateFilters,
} from './auditLog';

const ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const params = (q: string) => new URLSearchParams(q);

describe('audit log display helpers', () => {
  it('labels actions, keeping an unknown code as recorded', () => {
    expect(actionLabel('INSERT')).toBe('Created');
    expect(actionLabel('UPDATE')).toBe('Updated');
    expect(actionLabel('DELETE')).toBe('Deleted');
    expect(actionLabel('TRUNCATE')).toBe('TRUNCATE');
  });

  it('falls back to the table name for an unknown module', () => {
    expect(moduleLabel({ module: 'Patients', entity_type: 'customers' })).toBe('Patients');
    expect(moduleLabel({ module: null, entity_type: 'future_table' })).toBe('future_table');
  });

  it('names the single settings record and keeps other ids as recorded', () => {
    expect(recordLabel({ entity_type: 'pharmacy_settings', entity_id: 'true' })).toBe('Pharmacy settings record');
    expect(recordLabel({ entity_type: 'customers', entity_id: ID })).toBe(ID);
    expect(recordLabel({ entity_type: 'customers', entity_id: null })).toBeNull();
  });

  it('links only to pages that exist', () => {
    expect(recordHref({ entity_type: 'customers', entity_id: ID })).toBe(`/admin/patients/${ID}`);
    expect(recordHref({ entity_type: 'products', entity_id: ID })).toBe(`/admin/products/${ID}`);
    expect(recordHref({ entity_type: 'pharmacy_settings', entity_id: 'true' })).toBe('/admin/settings');
    expect(recordHref({ entity_type: 'suppliers', entity_id: ID })).toBeNull();
    expect(recordHref({ entity_type: 'customers', entity_id: '../etc' })).toBeNull();
    expect(recordHref({ entity_type: 'customers', entity_id: null })).toBeNull();
  });

  it('never invents a user', () => {
    expect(actorLabel(null)).toBe('Not recorded');
    expect(actorLabel({ id: ID, name: null })).toBe('User cccccccc');
    expect(actorLabel({ id: ID, name: 'Nimal' })).toBe('Nimal');
    expect(shortId('true')).toBe('true');
  });
});

describe('filters', () => {
  it('rejects an end date before the start date', () => {
    expect(validateFilters({ ...EMPTY_FILTERS, from: '2026-10-30', to: '2026-10-29' }).to).toBeDefined();
    expect(validateFilters({ ...EMPTY_FILTERS, from: '2026-10-30', to: '2026-10-30' })).toEqual({});
  });

  it('rejects record references with filter syntax or spaces', () => {
    for (const record of ['a,b', '%', 'Kamal Perera', 'x'.repeat(65)]) {
      expect(validateFilters({ ...EMPTY_FILTERS, record }).record).toBeDefined();
    }
    expect(validateFilters({ ...EMPTY_FILTERS, record: ` ${ID} ` })).toEqual({});
  });

  it('accepts only a user id or "none" for the user', () => {
    expect(validateFilters({ ...EMPTY_FILTERS, actor: 'none' })).toEqual({});
    expect(validateFilters({ ...EMPTY_FILTERS, actor: ID })).toEqual({});
    expect(validateFilters({ ...EMPTY_FILTERS, actor: 'admin' }).actor).toBeDefined();
  });

  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, action: 'UPDATE', record: ' ' })).toBe(1);
  });

  it('reads valid filters from the URL and ignores anything the API would refuse', () => {
    expect(filtersFromParams(params(`entity=customers&record=${ID}&action=UPDATE&from=2026-10-01&actor=none`))).toEqual({
      ...EMPTY_FILTERS,
      entity: 'customers',
      record: ID,
      action: 'UPDATE',
      from: '2026-10-01',
      actor: 'none',
    });
    expect(filtersFromParams(params('entity=sms_messages&action=TRUNCATE&from=yesterday&actor=bob&record=a,b'))).toEqual(EMPTY_FILTERS);
  });
});
