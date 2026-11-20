/**
 * The printed label (components/PrintableLabel.tsx) has fixed-height rows that hide whatever does not
 * fit. Content in the instruction area is centred, so an overflow is lost at the top and the bottom:
 * the dose row and the STAT line are the first to disappear. Names are shown in full or marked as not
 * fitting. This checks the real rendered preview so a label that would print with missing text is
 * never printed silently.
 */
/** Content must stay this far inside the box: printers round the label to their dot grid. */
export const SAFETY_MARGIN_PX = 1;

export function labelBodyOverflows(body: Element, marginPx = SAFETY_MARGIN_PX): boolean {
  const box = body.getBoundingClientRect();
  const children = Array.from(body.children).map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
  if (box.height === 0 || children.length === 0) return false;
  const top = Math.min(...children.map((r) => r.top));
  const bottom = Math.max(...children.map((r) => r.bottom));
  return top < box.top + marginPx || bottom > box.bottom - marginPx;
}

const SECTION_NAMES: Record<string, string> = {
  product: 'medicine name row',
  patient: 'patient / brand row',
  instructions: 'instructions (dose rows and Sinhala lines)',
  expiry: 'expiry row',
  footer: 'chemist footer',
};

/** Text elements (no element children) of `el`. */
function textLeaves(el: Element): Element[] {
  return Array.from(el.querySelectorAll('*')).filter((e) => e.children.length === 0 && (e.textContent || '').trim() !== '');
}

/**
 * Why one label (an element marked data-label) cannot be printed in full; empty when it can.
 * Checks: the instruction area's height; any name that does not fit even on two lines; and any text
 * in any row that runs past that row's edges.
 */
export function labelProblems(label: Element): string[] {
  const problems: string[] = [];
  const body = label.querySelector('[data-label-body]');
  if (body && labelBodyOverflows(body)) problems.push(SECTION_NAMES.instructions);

  for (const f of Array.from(label.querySelectorAll('[data-fit="overflow"]'))) {
    problems.push(`${f.getAttribute('data-fit-field') || 'name'} too long to print in full`);
  }

  const edge = label.getBoundingClientRect();
  for (const section of Array.from(label.querySelectorAll('[data-label-section]'))) {
    const r = section.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = SECTION_NAMES[section.getAttribute('data-label-section') || ''] || 'label';
    if (problems.includes(name)) continue;
    // A row pushed past the label's edges (e.g. the footer by a long header) is cut off when printed.
    if (edge.height > 0 && (r.top < edge.top - 0.5 || r.bottom > edge.bottom + 0.5 || r.left < edge.left - 0.5 || r.right > edge.right + 0.5)) {
      problems.push(name);
      continue;
    }
    // Names that fit are inside their cell by construction; names that don't are reported above.
    const cut = textLeaves(section).filter((e) => !e.hasAttribute('data-fit-field')).some((e) => {
      const x = e.getBoundingClientRect();
      return x.height > 0 && (x.top < r.top - 0.5 || x.bottom > r.bottom + 0.5 || x.left < r.left - 0.5 || x.right > r.right + 0.5);
    });
    if (cut) problems.push(name);
  }
  return problems;
}

/** Labels (marked data-label) inside `root` that cannot be printed in full, with the reasons. */
export function labelFitReport(root: ParentNode): { index: number; problems: string[] }[] {
  return Array.from(root.querySelectorAll('[data-label]')).flatMap((el, index) => {
    const problems = labelProblems(el);
    return problems.length ? [{ index, problems }] : [];
  });
}

/** Indexes of the labels inside `root` that cannot be printed in full. */
export function overflowingLabels(root: ParentNode): number[] {
  return labelFitReport(root).map((r) => r.index);
}
