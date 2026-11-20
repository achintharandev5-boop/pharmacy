// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { labelBodyOverflows, labelFitReport, labelProblems, overflowingLabels } from './labelFit';

/** jsdom has no layout, so rectangles are supplied directly. */
function el(box: { top: number; bottom: number }, children: { top: number; bottom: number }[]) {
  const rect = (r: { top: number; bottom: number }) => ({ ...r, height: r.bottom - r.top }) as DOMRect;
  return {
    getBoundingClientRect: () => rect(box),
    children: children.map((c) => ({ getBoundingClientRect: () => rect(c) })),
  } as unknown as Element;
}

describe('labelBodyOverflows', () => {
  it('content inside the 26 mm box fits', () => {
    expect(labelBodyOverflows(el({ top: 0, bottom: 98 }, [{ top: 20, bottom: 40 }, { top: 44, bottom: 78 }]))).toBe(false);
  });

  it('content cut off at the top and bottom (centred overflow) is detected', () => {
    // Measured in Edge: 137 px of content in a 98 px box, centred
    expect(labelBodyOverflows(el({ top: 0, bottom: 98 }, [{ top: -20, bottom: 0 }, { top: 4, bottom: 117 }]))).toBe(true);
  });

  it('content touching the edge is refused: 1 px must stay clear at top and bottom', () => {
    expect(labelBodyOverflows(el({ top: 0, bottom: 98 }, [{ top: 0, bottom: 98 }]))).toBe(true);
    expect(labelBodyOverflows(el({ top: 0, bottom: 98 }, [{ top: 1, bottom: 97 }]))).toBe(false);
  });

  it('an empty or unrendered body never blocks', () => {
    expect(labelBodyOverflows(el({ top: 0, bottom: 0 }, [{ top: 0, bottom: 300 }]))).toBe(false);
    expect(labelBodyOverflows(el({ top: 0, bottom: 98 }, []))).toBe(false);
  });
});

describe('labelProblems / labelFitReport (every row of the label)', () => {
  type R = { top: number; bottom: number; left: number; right: number };
  const at = (e: Element, r: R) => {
    e.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }) as DOMRect;
  };
  /** A label with a product row (name + qty) and a 115 px instruction area holding one line. */
  function label(opts: { nameFit?: string; qty?: R; line?: R } = {}) {
    const root = document.createElement('div');
    root.innerHTML = `<div data-label>
      <div data-label-section="product"><span data-fit-field="medicine name" data-fit="${opts.nameFit ?? 'ok'}">PARACETAMOL</span><span id="qty">Qty: 15</span></div>
      <div data-label-body data-label-section="instructions"><div id="line">කෑමට පසු ගන්න</div></div>
    </div>`;
    const q = (s: string) => root.querySelector(s)!;
    at(q('[data-label]'), { top: 0, bottom: 189, left: 0, right: 264 });
    at(q('[data-label-section="product"]'), { top: 0, bottom: 19, left: 0, right: 264 });
    at(q('[data-fit-field]'), { top: 2, bottom: 17, left: 8, right: 200 });
    at(q('#qty'), opts.qty ?? { top: 4, bottom: 15, left: 210, right: 256 });
    at(q('[data-label-body]'), { top: 36, bottom: 151, left: 0, right: 264 });
    at(q('#line'), opts.line ?? { top: 80, bottom: 100, left: 40, right: 220 });
    return root;
  }

  it('a label that fits has no problems', () => {
    expect(labelFitReport(label())).toEqual([]);
  });

  it('a name that does not fit even on two lines blocks printing and is named', () => {
    expect(labelFitReport(label({ nameFit: 'overflow' }))).toEqual([{ index: 0, problems: ['medicine name too long to print in full'] }]);
  });

  it('text running past the side of any row is detected', () => {
    expect(labelProblems(label({ qty: { top: 4, bottom: 15, left: 230, right: 270 } }).querySelector('[data-label]')!)).toEqual(['medicine name row']);
  });

  it('instructions cut off at the top or bottom are reported once', () => {
    expect(labelProblems(label({ line: { top: 30, bottom: 160, left: 40, right: 220 } }).querySelector('[data-label]')!)).toEqual(['instructions (dose rows and Sinhala lines)']);
  });

  it('overflowingLabels gives the indexes', () => {
    expect(overflowingLabels(label({ nameFit: 'overflow' }))).toEqual([0]);
  });
});
