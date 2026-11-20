'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- label data is the builder's untyped output, as in PrintableLabel.tsx */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LabelCard, PRINT_LABEL_CSS } from '../../../components/PrintableLabel';
import { labelProblems } from '../../../lib/labelFit';
import { SCENARIOS, buildScenarioLabels } from './scenarios';

const WORDINGS = ['current', 'spec'] as const;
type Wording = (typeof WORDINGS)[number];

export type CardResult = {
  scenario: string; wording: string;
  content: number; box: number;
  /** What the print guard says (empty = Print & Save allowed). */
  guard: string[];
  /** Independent check: text clipped or running past an edge anywhere on the label. */
  clipped: string[];
  /** Text shown with "…" (must never happen). */
  ellipsis: string[];
  fitSizes: Record<string, string>;
  statPills: number; statPhraseBadges: number;
};

function measureCard(card: Element, scenario: string, wording: string): CardResult {
  const label = card.querySelector('[data-label]')!;
  const body = label.querySelector('[data-label-body]')!;
  const b = body.getBoundingClientRect();
  const kids = Array.from(body.children).map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
  const content = kids.length ? Math.max(...kids.map((r) => r.bottom)) - Math.min(...kids.map((r) => r.top)) : 0;
  const leaves = (el: Element) => Array.from(el.querySelectorAll('*')).filter((e) => e.children.length === 0 && (e.textContent || '').trim());
  const clipped: string[] = [];
  for (const s of Array.from(label.querySelectorAll('[data-label-section]'))) {
    const r = s.getBoundingClientRect();
    for (const e of leaves(s)) {
      const x = e.getBoundingClientRect();
      const he = e as HTMLElement;
      const outside = x.top < r.top - 0.5 || x.bottom > r.bottom + 0.5 || x.left < r.left - 0.5 || x.right > r.right + 0.5;
      const hiddenInside = he.scrollWidth > he.clientWidth + 1 || he.scrollHeight > he.clientHeight + 1;
      if (x.height > 0 && (outside || hiddenInside)) clipped.push(`${s.getAttribute('data-label-section')}: ${(e.textContent || '').trim().slice(0, 30)}`);
    }
  }
  const ellipsis = leaves(label).filter((e) => getComputedStyle(e).textOverflow === 'ellipsis').map((e) => (e.textContent || '').trim());
  const fitSizes = Object.fromEntries(Array.from(label.querySelectorAll('[data-fit-field]')).map((e) => [e.getAttribute('data-fit-field'), `${e.getAttribute('data-fit')} ${e.getAttribute('data-fit-size') || ''}`.trim()]));
  return {
    scenario, wording,
    content: Math.round(content * 10) / 10, box: Math.round(b.height * 10) / 10,
    guard: labelProblems(label), clipped, ellipsis, fitSizes,
    statPills: Array.from(label.querySelectorAll('div')).filter((d) => /^STAT /.test(d.textContent || '') && d.children.length === 0).length,
    statPhraseBadges: label.querySelectorAll('[data-stat-phrase]').length,
  };
}

export default function PrintCheck() {
  const labels = useMemo(() => ({ current: buildScenarioLabels('current'), spec: buildScenarioLabels('spec') }), []);
  const [results, setResults] = useState<CardResult[] | null>(null);
  const [fonts, setFonts] = useState<Record<string, boolean>>({});
  const [printWording, setPrintWording] = useState<Wording | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = new URLSearchParams(window.location.search).get('print');
      await document.fonts.ready;
      if (!cancelled && (q === 'current' || q === 'spec')) setPrintWording(q);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled || !root.current) return;
      const out = Array.from(root.current.querySelectorAll('[data-card]')).map((c) => {
        const [s, w] = c.getAttribute('data-card')!.split('|');
        return measureCard(c, s, w);
      });
      const f = { gemunu: document.fonts.check('bold 13.5px "Gemunu Libre"'), noto: document.fonts.check('bold 13.5px "Noto Sans Sinhala"') };
      setFonts(f);
      setResults(out);
      (window as any).__labelCheck = { fonts: f, results: out };
    })();
    return () => { cancelled = true; };
  }, []);

  const r = (s: string, w: string) => results?.find((x) => x.scenario === s && x.wording === w);
  const verdict = (x?: CardResult) => !x ? '…' : x.guard.length ? `blocked: ${x.guard.join('; ')}` : 'prints';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_LABEL_CSS }} />
      {printWording && (
        <div className="print-only" aria-hidden="true">
          {labels[printWording].map((l: any) => <LabelCard key={l.id} labelItem={l} />)}
        </div>
      )}
      <div ref={root} className="no-print p-4 bg-white text-slate-900 min-h-screen">
        <h1 className="text-xl font-bold">Printed label check (development only)</h1>
        <p className="text-sm text-slate-600 max-w-4xl">
          The real 70 × 50 mm label (components/PrintableLabel.tsx) at 1:1, for sample prescriptions built by the real label builder in both
          wordings. Instruction area: content / box height in CSS px (96 px = 25.4 mm). &quot;blocked&quot; = the print guard refuses Print &amp; Save.
          Spec wording is shown for review only; it is not switched on. Fonts loaded: {JSON.stringify(fonts)}
        </p>
        <table className="text-xs border-collapse my-4" data-results>
          <thead><tr><th className="border p-1">Scenario</th>{WORDINGS.map((w) => <th key={w} className="border p-1">{w} wording</th>)}</tr></thead>
          <tbody>
            {SCENARIOS.map((s) => (
              <tr key={s.id}>
                <td className="border p-1">{s.id} {s.name}</td>
                {WORDINGS.map((w) => {
                  const x = r(s.id, w);
                  return <td key={w} className={`border p-1 ${x?.guard.length ? 'bg-red-100' : ''}`}>{x ? `${x.content}/${x.box} · ${verdict(x)}` : '…'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {SCENARIOS.map((s, si) => (
          <section key={s.id} className="mb-6" data-scenario={s.id}>
            <h2 className="font-semibold text-sm">{s.id} · {s.group} · {s.name}</h2>
            <div className="flex flex-wrap gap-4 mt-1">
              {WORDINGS.map((w) => (
                <figure key={w} className="m-0">
                  <div data-card={`${s.id}|${w}`}><LabelCard labelItem={labels[w][si]} /></div>
                  <figcaption className="text-[10px] text-slate-600 max-w-[70mm]">{w} wording · {verdict(r(s.id, w))}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
