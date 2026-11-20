import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS, navSectionsFor } from './nav';

const labels = (role: Parameters<typeof navSectionsFor>[0]) =>
  navSectionsFor(role).flatMap((s) => s.items.map((i) => i.label));

describe('navSectionsFor', () => {
  it('gives an administrator every page', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.label));
    expect(labels('admin')).toEqual(all);
  });

  it('gives pharmacists and staff every page except the administrator-only audit log', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.label)).filter((l) => l !== 'Audit log');
    for (const role of ['pharmacist', 'staff'] as const) expect(labels(role)).toEqual(all);
  });

  it('shows the audit log link to administrators only', () => {
    expect(labels('admin')).toContain('Audit log');
    for (const role of ['pharmacist', 'staff', 'cashier', null] as const) expect(labels(role)).not.toContain('Audit log');
  });

  it('gives a cashier only the point of sale', () => {
    expect(labels('cashier')).toEqual(['Point of sale']);
  });

  it('gives an unknown or missing role nothing, rather than everything', () => {
    expect(navSectionsFor(null)).toEqual([]);
    expect(navSectionsFor(undefined)).toEqual([]);
  });

  it('never returns an empty section heading', () => {
    expect(navSectionsFor('cashier').every((s) => s.items.length > 0)).toBe(true);
  });
});
