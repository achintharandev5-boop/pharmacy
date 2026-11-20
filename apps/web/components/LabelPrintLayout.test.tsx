import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { LabelPaperProvider } from './LabelPaper';
import { labelPaperFrom } from '../lib/labelPaper';
import { LabelCard, PrintableLabel, PRINT_LABEL_CSS, INSTRUCTION_SIZES } from './PrintableLabel';
import { buildFinalInstruction } from '../lib/labelBuilder';
import { labelProblems } from '../lib/labelFit';
import { setWordingModeForTests } from '../lib/instructionEngine';

/** Printed 70 × 50 mm label: page setup, optional rows, footer branding, fitting and the guard. */
const d = (qty: number, isFraction = false) => ({ qty, isFraction });
const none = d(0);
const base = {
  id: 'l1',
  product: { id: 'p1', name: 'Paracetamol 500mg', product_type: 'Karal' },
  productQuantity: 10,
  customerName: '',
  dosage: { morning: d(1), lunch: none, night: d(1) },
  frequencyDosage: none,
  additionalInstructions: ['TAKE', 'AFTER'],
  reasons: [],
  selectedDaysOfWeek: [],
};
const build = (over: Record<string, unknown> = {}) => buildFinalInstruction({ ...base, ...over } as Parameters<typeof buildFinalInstruction>[0]);
const card = (over: Record<string, unknown> = {}) => render(<LabelCard labelItem={build(over)} />).container;
const sections = (c: Element) => Array.from(c.querySelectorAll('[data-label-section]')).map((el) => el.getAttribute('data-label-section'));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_PHARMACY_NAME', '');
  vi.stubEnv('NEXT_PUBLIC_PHARMACY_ADDRESS', '');
  vi.stubEnv('NEXT_PUBLIC_PHARMACY_PHONE', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); setWordingModeForTests(null); });

describe('page setup', () => {
  it('each label is an exact 70 × 50 mm box with a safe margin inside it (1 mm top and bottom, 1.5 mm sides)', () => {
    const label = card().querySelector('[data-label]') as HTMLElement;
    expect(label).toHaveClass('print-label-page', 'overflow-hidden');
    expect(label.style.width).toBe('70mm');
    expect(label.style.height).toBe('50mm');
    expect(label.style.padding).toBe('1mm 1.5mm');
    expect(label.style.boxSizing).toBe('border-box');
    expect(label.className).not.toMatch(/scale-|zoom/);
  });

  it('print CSS: 70 × 50 mm page, no margins, one label per page, no break inside or after the last', () => {
    const css = PRINT_LABEL_CSS.replace(/\s+/g, ' ');
    expect(css).toContain('@page { size: 70mm 50mm; margin: 0; }');
    expect(css).toMatch(/\.print-label-page \{[^}]*width: 70mm !important; height: 50mm !important;[^}]*break-after: page !important;[^}]*break-inside: avoid !important;/);
    expect(css).toMatch(/\.print-label-page:last-child \{ page-break-after: auto !important; break-after: auto !important; \}/);
    expect(css).not.toMatch(/transform:\s*scale|zoom:/);
    // Sinhala fonts, with Windows' own Sinhala fonts as offline fallbacks.
    expect(css).toMatch(/'Gemunu Libre', 'Noto Sans Sinhala', 'Iskoola Pota', 'Nirmala UI'/);
  });

  it('uses configured millimeters for both preview and print, including fractional sizes', () => {
    const paper = labelPaperFrom({ label_width_mm: 80.5, label_height_mm: 40 });
    const { container } = render(<LabelPaperProvider paper={paper}><PrintableLabel data={build()} /></LabelPaperProvider>);
    expect(container.querySelector('[data-label]')).toHaveStyle({ width: '80.5mm', height: '40mm', minWidth: '80.5mm', maxHeight: '40mm' });
    expect(container.querySelector('style')?.textContent).toContain('size: 80.5mm 40mm;');
    expect(container.querySelector('style')?.textContent).toContain('position: static !important;');
    expect(container.querySelector('style')?.textContent).toContain('body:has(.print-only)');
  });

  it('falls back to installed stock for absent or invalid dimensions', () => {
    for (const settings of [null, { label_width_mm: 0, label_height_mm: 50 }, { label_width_mm: 80, label_height_mm: NaN }, { label_width_mm: Infinity, label_height_mm: 50 }]) {
      expect(labelPaperFrom(settings)).toEqual({ widthMm: 70, heightMm: 50 });
    }
  });

  it('several labels print as separate 70 × 50 mm pages, each with its own content', () => {
    const labels = [build({ id: 'a' }), build({ id: 'b', customerName: 'Nimal Perera' }), build({ id: 'c', product: { id: 'p2', name: 'Amoxicillin', product_type: 'Karal' } })];
    const { container } = render(<PrintableLabel data={labels} />);
    const pages = container.querySelectorAll('.print-only > [data-label]');
    expect(pages).toHaveLength(3);
    pages.forEach((page) => expect(page).toHaveStyle({ width: '70mm', height: '50mm' }));
    expect(pages[1]).toHaveTextContent('Patient: Nimal Perera');
    expect(pages[0]).not.toHaveTextContent('Patient');
    expect(pages[2]).toHaveTextContent('Amoxicillin'); // shown in capitals by CSS only
    expect(pages[0]).not.toHaveTextContent('Amoxicillin');
  });
});

describe('optional rows are printed only when they have a value', () => {
  it('no patient: the patient row and its label are omitted', () => {
    const c = card();
    expect(sections(c)).toEqual(['product', 'instructions', 'footer']);
    expect(c.textContent).not.toMatch(/Patient|Pt:/);
  });

  it('patient and brand present: printed in full', () => {
    const c = card({ customerName: 'Nimal Perera', alternativeProductName: 'Panadol' });
    expect(c.querySelector('[data-label-section="patient"]')).toHaveTextContent('Brand: Panadol');
    expect(c.querySelector('[data-label-section="patient"]')).toHaveTextContent('Pt: Nimal Perera');
  });

  it('no medicine name: no "MEDICINE" placeholder; quantity alone keeps a small header', () => {
    const qtyOnly = card({ product: null, productName: '' });
    expect(qtyOnly.textContent).not.toContain('MEDICINE');
    expect(qtyOnly.querySelector('[data-label-section="product"]')).toHaveTextContent('Qty: 10');
    const nothing = card({ product: null, productName: '', productQuantity: null });
    expect(sections(nothing)).toEqual(['instructions', 'footer']);
  });

  it('no placeholder underscores or empty headings anywhere', () => {
    const c = card({ product: null, productName: '', productQuantity: null });
    expect(c.textContent).not.toMatch(/_{2,}|Brand:|Patient:|EXP DATE/);
  });

  it('reasons: printed when selected, no reason section otherwise', () => {
    expect(card().querySelector('[data-label-reasons]')).toBeNull();
    const c = card({ additionalInstructions: ['TAKE', 'AFTER', 'REASONS'], reasons: ['කැස්සට'] });
    expect(c.querySelector('[data-label-reasons]')).toHaveTextContent('කැස්සට');
  });
});

describe('footer branding (configured, never hardcoded)', () => {
  it('not configured: no pharmacy name, address or phone; only the issue date', () => {
    const footer = card().querySelector('[data-label-section="footer"]')!;
    expect(footer.querySelector('[data-label-pharmacy]')).toBeNull();
    expect(footer.textContent).toMatch(/^Date: \d{2}\/\d{2}\/\d{4}$/);
    expect(card().textContent).not.toMatch(/SISILA|Koralawella|0777/);
  });

  it('configured: printed exactly as written; Remove Address hides only the address', () => {
    vi.stubEnv('NEXT_PUBLIC_PHARMACY_NAME', 'Test Pharmacy');
    vi.stubEnv('NEXT_PUBLIC_PHARMACY_ADDRESS', '12 Main Street, Colombo');
    vi.stubEnv('NEXT_PUBLIC_PHARMACY_PHONE', 'Tel - 011 000 0000');
    const footer = card().querySelector('[data-label-section="footer"]')!;
    expect(footer).toHaveTextContent('Test Pharmacy');
    expect(footer.querySelector('[data-label-address]')).toHaveTextContent('12 Main Street, Colombo');
    expect(footer.querySelector('[data-label-phone]')).toHaveTextContent('Tel - 011 000 0000');
    const hidden = card({ showAddress: false }).querySelector('[data-label-section="footer"]')!;
    expect(hidden.querySelector('[data-label-address]')).toBeNull();
    expect(hidden).toHaveTextContent('Test Pharmacy');
  });
});

describe('instruction wording is printed exactly as built', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['Morning/Night + TAKE AFTER', {}],
    ['STAT then 8H', { additionalInstructions: ['STAT', '8H', 'TAKE', 'AFTER'], stat: { qty: 2, isFraction: false, followUp: '8H' }, frequencyDosage: d(1), dosage: { morning: none, lunch: none, night: none } }],
    ['5H', { additionalInstructions: ['5H', 'TAKE', 'AFTER'], frequencyDosage: d(1), dosage: { morning: none, lunch: none, night: none } }],
    ['6H', { additionalInstructions: ['6H', 'GIVE', 'BEFORE'], frequencyDosage: d(0.5, true), dosage: { morning: none, lunch: none, night: none } }],
    ['8H', { additionalInstructions: ['8H', 'TAKE', 'AFTER'], frequencyDosage: d(1), dosage: { morning: none, lunch: none, night: none } }],
    ['Daily', { additionalInstructions: ['DAILY', 'EMPTY STOMACH', 'TAKE'], frequencyDosage: d(1), dosage: { morning: none, lunch: none, night: none } }],
    ['Weekly', { additionalInstructions: ['WEEKLY', 'EMPTY STOMACH', 'TAKE'], weeklyDosage: { qty: 1, isFraction: false, confirmed: true }, dosage: { morning: none, lunch: none, night: none } }],
    ['Name of Days', { selectedDaysOfWeek: ['MONDAY', 'FRIDAY'], daysConfirmed: true }],
    ['Till to the Day', { weekdayRange: { start: 'MONDAY', end: 'FRIDAY', confirmed: true }, additionalInstructions: ['TILL TO DAY', 'DAILY', 'EMPTY STOMACH', 'TAKE'], frequencyDosage: d(1), dosage: { morning: none, lunch: none, night: none } }],
    ['Unequal circled rows', { dosage: { morning: d(1), lunch: none, night: d(0.5, true) } }],
  ];
  it.each(cases)('%s', (_name, over) => {
    const built = build(over);
    const c = render(<LabelCard labelItem={built} />).container;
    const body = c.querySelector('[data-label-body]')!;
    const printed = (body.textContent ?? '').replace(/\s+/g, '');
    for (const line of built.additionalInstructions ?? []) {
      if (/[඀-෿]/.test(line)) expect(printed).toContain(line.replace(/\s+/g, ''));
    }
    if (built.daysPrefix) expect(printed).toContain(built.daysPrefix.replace(/\s+/g, ''));
    // Every Sinhala line uses the fitted instruction size.
    for (const el of Array.from(body.querySelectorAll('.sinhala-text[style]'))) expect(el.getAttribute('style')).toMatch(/var\(--ins-size\)/);
  });
});

describe('fitting and the print guard', () => {
  /** Layout stand-in: the instruction box is `box` px high; content height grows with the font size. */
  function fakeLayout(box: number, linesTall: number) {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-label-body') ? box : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, height: bottom - top, width: 100, x: 0, y: top, toJSON: () => ({}) });
      if (this.hasAttribute('data-label-body')) return rect(0, box) as DOMRect;
      const body = this.closest('[data-label-body]') as HTMLElement | null;
      if (body && this.parentElement === body) {
        const size = parseFloat(body.style.getPropertyValue('--ins-size'));
        return rect(1, 1 + size * linesTall) as DOMRect;
      }
      return rect(0, 0) as DOMRect;
    });
  }

  it('uses the largest size that fits (reclaimed space first), never below 13.5 px', () => {
    fakeLayout(60, 4); // 17×4 and 16×4, 15×4 do not fit 59 px; 14×4 = 56 does
    const body = card().querySelector('[data-label-body]') as HTMLElement;
    expect(body.dataset.insSize).toBe('14');
    expect(body.dataset.insFit).toBe('ok');
  });

  it('when even 13.5 px does not fit it stays at 13.5 px and the guard blocks the label', () => {
    fakeLayout(40, 4);
    const c = card();
    const body = c.querySelector('[data-label-body]') as HTMLElement;
    expect(body.dataset.insSize).toBe('13.5');
    expect(body.dataset.insFit).toBe('overflow');
    expect(Math.min(...INSTRUCTION_SIZES)).toBe(13.5);
    expect(labelProblems(c.querySelector('[data-label]')!)).toContain('instructions (dose rows and Sinhala lines)');
  });

  it('a row pushed past the label edge (e.g. the footer) is reported', () => {
    const c = card();
    const label = c.querySelector('[data-label]') as HTMLElement;
    const footer = c.querySelector('[data-label-section="footer"]') as HTMLElement;
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, height: bottom - top, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(rect(0, 189));
    vi.spyOn(footer, 'getBoundingClientRect').mockReturnValue(rect(180, 200));
    expect(labelProblems(label)).toContain('chemist footer');
  });
});
