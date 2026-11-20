import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { LabelCard } from './PrintableLabel';
import { buildFinalInstruction } from '../lib/labelBuilder';

/**
 * The Admin Settings module must not change printed labels: until decision Q-S1 the footer comes
 * from NEXT_PUBLIC_PHARMACY_* only, and nothing on the print path reads the saved settings.
 */
const d = (qty: number) => ({ qty, isFraction: false });
const item = buildFinalInstruction({
  id: 'l1',
  product: { id: 'p1', name: 'Paracetamol 500mg', product_type: 'Karal' },
  productQuantity: 10,
  customerName: '',
  dosage: { morning: d(1), lunch: d(0), night: d(1) },
  frequencyDosage: d(0),
  additionalInstructions: ['TAKE', 'AFTER'],
  reasons: [],
  selectedDaysOfWeek: [],
} as unknown as Parameters<typeof buildFinalInstruction>[0]);

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_PHARMACY_NAME', 'Env Pharmacy');
  vi.stubEnv('NEXT_PUBLIC_PHARMACY_ADDRESS', 'Env Address');
  vi.stubEnv('NEXT_PUBLIC_PHARMACY_PHONE', '0110000000');
});
afterEach(() => vi.unstubAllEnvs());

describe('printed label is independent of Admin Settings', () => {
  it('prints the environment pharmacy details, on the unchanged 70 × 50 mm label', () => {
    const { container } = render(<LabelCard labelItem={item} />);
    const label = container.querySelector('[data-label]') as HTMLElement;
    expect(label).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(label.textContent).toContain('Env Pharmacy');
    expect(container.querySelector('[data-label-address]')?.textContent).toBe('Env Address');
    expect(container.querySelector('[data-label-phone]')?.textContent).toContain('0110000000');
  });

  it.each(['./PrintableLabel.tsx', '../lib/pharmacyBranding.ts', '../app/label/page.tsx'])('%s does not read the saved settings', (path) => {
    const text = source(path);
    expect(text).not.toMatch(/actions\/settings|pharmacySettings|admin\/settings/);
  });
});
