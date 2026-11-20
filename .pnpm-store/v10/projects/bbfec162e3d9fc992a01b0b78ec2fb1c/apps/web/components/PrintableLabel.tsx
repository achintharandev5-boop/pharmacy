'use client';

import { formatDays } from '../lib/nameOfDays';
import { formattedReasons } from '../lib/reasons';
import React, { useLayoutEffect, useRef } from 'react';
import { labelBodyOverflows } from '../lib/labelFit';
import { pharmacyBranding } from '../lib/pharmacyBranding';
import type { BuiltLabelData } from '../lib/labelBuilder';
import { frequencyInstruction } from '../lib/instructionEngine';

/*
 * The printed 70 × 50 mm label (one per page; @page 70mm 50mm, margin 0). A safe margin inside the
 * label (1 mm top and bottom, 1.5 mm left and right) keeps all text away from the paper edge. Rows, top to bottom:
 *   medicine name + quantity · patient / brand · INSTRUCTIONS (all remaining height) · expiry · footer
 * Optional rows are printed only when they have a value: no "Patient: ____", "MEDICINE" or empty
 * expiry placeholders (Document 5 pp. 53–55); their space goes to the instructions. The Sinhala
 * instructions are fitted to that space, from 17 px down to 13.5 px (the previous fixed size), never
 * smaller. Every row is marked data-label-section so the print guard (lib/labelFit.ts) can refuse
 * a label whose text would be cut off anywhere.
 */

/**
 * A name shown in full: never shortened with "…". It steps down through `sizes` on one line, then
 * wraps onto two lines at `wrapSize`. If it still does not fit it is marked data-fit="overflow" and
 * the print guard refuses to print the label, naming `field`.
 */
function FitText({ text, field, sizes, wrapSize, className = '' }: { text: string; field: string; sizes: number[]; wrapSize: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const sizesKey = sizes.join(',');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const steps = sizesKey.split(',').map(Number);
    const fit = () => {
      const box = el.parentElement;
      if (cancelled || !box) return;
      if (el.clientWidth === 0) {
        el.dataset.fit = 'unmeasured';
        return;
      }
      el.style.whiteSpace = 'nowrap';
      el.style.lineHeight = '';
      for (const s of steps) {
        el.style.fontSize = `${s}px`;
        if (el.scrollWidth <= el.clientWidth + 0.5) {
          el.dataset.fit = 'ok';
          el.dataset.fitSize = String(s);
          return;
        }
      }
      el.style.whiteSpace = 'normal';
      el.style.fontSize = `${wrapSize}px`;
      el.style.lineHeight = '1';
      const fits = el.scrollWidth <= el.clientWidth + 0.5 && el.getBoundingClientRect().height <= box.clientHeight + 0.5;
      el.dataset.fit = fits ? 'ok' : 'overflow';
      el.dataset.fitSize = `${wrapSize} (2 lines)`;
    };
    fit();
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [text, sizesKey, wrapSize]);
  return (
    <span ref={ref} data-fit-field={field} className={`min-w-0 overflow-hidden ${className}`} style={{ fontSize: sizes[0] }}>
      {text}
    </span>
  );
}

const BADGE = 'inline-flex items-center justify-center border-[1.5px] border-black rounded-full min-w-[22px] h-[22px] px-1 text-[12px] font-black bg-white';
/** Sinhala instruction sizes tried in order: the largest that fits is used. 13.5 px was the
 *  previous fixed size and is the smallest used; below that the print guard refuses the label. */
export const INSTRUCTION_SIZES = [17, 16, 15, 14, 13.5];
const SINHALA_FONTS = "'Gemunu Libre', 'Noto Sans Sinhala', 'Iskoola Pota', 'Nirmala UI', sans-serif";

const THEN = 'ඉන්පසු';

export function LabelCard({ labelItem }: { labelItem: BuiltLabelData | null | undefined }) {
  return labelItem ? <LabelSheet labelItem={labelItem} /> : null;
}

function LabelSheet({ labelItem }: { labelItem: BuiltLabelData }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentKey = JSON.stringify(labelItem);
  // Fits the instruction area: the largest INSTRUCTION_SIZES entry whose content fits.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled || !el.isConnected) return;
      if (el.clientHeight === 0) { el.dataset.insFit = 'unmeasured'; return; }
      for (const size of INSTRUCTION_SIZES) {
        el.style.setProperty('--ins-size', `${size}px`);
        if (!labelBodyOverflows(el) && el.scrollWidth <= el.clientWidth + 0.5) {
          el.dataset.insSize = String(size);
          el.dataset.insFit = 'ok';
          return;
        }
      }
      el.dataset.insSize = String(INSTRUCTION_SIZES[INSTRUCTION_SIZES.length - 1]);
      el.dataset.insFit = 'overflow'; // the print guard reports and blocks this label
    };
    fit();
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    // The area grows or shrinks when the name rows settle (fonts, two-line names): fit again.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null;
    observer?.observe(el);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', fit);
      observer?.disconnect();
    };
  }, [contentKey]);
  const branding = pharmacyBranding();

  const removeAddress = labelItem.showAddress === false || labelItem.additionalInstructions?.includes('REMOVE ADDRESS');

  // Collect all Sinhala instructions
  const sinhalaInstructions: string[] = labelItem.additionalInstructions?.filter((inst: string) =>
    /[඀-෿]/.test(inst)
  ) || [];

  const FREQUENCY_TAGS = ['STAT', 'SOS', '6H', '8H', '5H', 'EOD', 'DAILY', 'EVENING'];

  const otherInstructions: string[] = labelItem.additionalInstructions?.filter(
    (inst: string) => !/[඀-෿]/.test(inst) &&
                      inst !== 'REMOVE ADDRESS' &&
                      inst !== 'ADD EXP DATE' &&
                      inst !== 'REASONS' &&
                      !FREQUENCY_TAGS.includes(inst)
  ) || [];

  // Expiry date: the GRN batch date selected with Add Expiry Date, printed exactly as recorded
  // (YYYY-MM-DD, a calendar date: no time-zone conversion). Never looked up or guessed here.
  const expDate = labelItem.expiryDate;
  const prodName = labelItem.productName?.trim() || '';
  const brand = labelItem.alternativeProductName?.trim() || '';

  const customerName = labelItem.customerName?.trim() || '';
  const hasQty = Boolean(labelItem.productQuantity && String(labelItem.productQuantity).trim());

  // Date of issue (DD/MM/YYYY)
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const reasonLines = formattedReasons(labelItem);
  const unequalRows = labelItem.unequalDigital && !labelItem.consolidatedDosage ? labelItem.digitalRows : null;

  // The builder includes the initial quantity in the approved phrase in both wording modes.
  // Suppress the legacy English pill and render the initial phrase before regular dosing rows.
  const statInPhrase: { phrase: string; qty: string; followUp: string | null } | null = labelItem.statInPhrase || null;
  const showStatPill = Boolean(labelItem.stat) && !statInPhrase;
  const tags = [...otherInstructions, ...(statInPhrase?.followUp ? [`THEN ${statInPhrase.followUp}`] : [])];

  // ඉන්පසු ("then") joins the end of the line before it: same words, same order. No other
  // instructions share a line, so separate instructions are never read as one sentence.
  const lines = sinhalaInstructions.reduce<string[]>((acc, line) => {
    if (line === THEN && acc.length > 0) acc[acc.length - 1] = `${acc[acc.length - 1]} ${THEN}`;
    else acc.push(line);
    return acc;
  }, []);

  // Instruction text size comes from the fitted --ins-size (see useInstructionFit).
  const lineClass = 'sinhala-text font-bold text-black tracking-wide leading-[1.25]';
  const lineStyle = { fontSize: 'var(--ins-size)' };
  const renderLine = (line: string, i: number) => {
    if (!statInPhrase || !line.startsWith(statInPhrase.phrase)) return <div key={i} className={lineClass} style={lineStyle}>{line}</div>;
    return (
      <div key={i} data-stat-phrase className={lineClass} style={lineStyle}>{line}{' '}</div>
    );
  };

  return (
    <div
      data-label
      className="print-label-page w-[70mm] h-[50mm] min-w-[70mm] max-w-[70mm] min-h-[50mm] max-h-[50mm] box-border flex flex-col bg-white text-black leading-none overflow-hidden select-none"
      style={{
        boxSizing: 'border-box',
        padding: '1mm 1.5mm',
        fontFamily: `'Segoe UI', Arial, ${SINHALA_FONTS}`,
        ['--ins-size' as string]: `${INSTRUCTION_SIZES[0]}px`,
      }}
    >

      {/* SECTION 1: Medicine name (in full, FitText) and quantity; omitted when neither is known */}
      {(prodName || hasQty) && (
        <div data-label-section="product" className="shrink-0 max-h-[9mm] flex items-center justify-between gap-1.5 pb-[0.6mm] border-b-[1.5px] border-black font-black leading-none overflow-hidden">
          {prodName ? (
            <FitText field="medicine name" text={prodName} sizes={[13, 12, 11, 10, 9]} wrapSize={9} className="flex-1 uppercase tracking-wide" />
          ) : <span className="flex-1" />}
          {hasQty && (
            <span className="shrink-0 font-black text-[11px] whitespace-nowrap">
              Qty: {labelItem.productQuantity}
            </span>
          )}
        </div>
      )}

      {/* SECTION 2: Patient and alternative brand; printed only when present */}
      {(customerName || brand) && (
        <div data-label-section="patient" className="shrink-0 max-h-[7.5mm] flex items-center gap-2 py-[0.4mm] border-b border-black leading-none overflow-hidden">
          {brand && (
            <div className="flex-1 min-w-0 flex items-center max-h-[7mm]">
              <FitText field="alternative brand name" text={`Brand: ${brand}`} sizes={[9.5, 9, 8.5, 8]} wrapSize={8} className="font-bold" />
            </div>
          )}
          {customerName && (
            <div className="flex-1 min-w-0 flex items-center max-h-[7mm]">
              <FitText field="patient name" text={brand ? `Pt: ${customerName}` : `Patient: ${customerName}`} sizes={[10, 9.5, 9, 8.5, 8]} wrapSize={8} className="font-extrabold" />
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Instructions: all remaining height, Sinhala fitted to it (useInstructionFit) */}
      <div ref={bodyRef} data-label-body data-label-section="instructions" className="flex-1 min-h-0 flex flex-col items-center justify-center px-0.5 py-[0.5mm] text-center leading-tight overflow-hidden gap-[0.5mm]">
        {statInPhrase && lines.filter(line => line.startsWith(statInPhrase.phrase)).map(renderLine)}

        {labelItem.daysPrefix && <div className={lineClass} style={lineStyle}>{labelItem.daysPrefix}{' '}</div>}

        {labelItem.weeklyPrefix && renderLine(labelItem.weeklyPrefix, -1)}

        {/* Document 5 Picture 5: selected time rows on the left, administration on the right. */}
        {unequalRows && (
          <div data-digital-layout="unequal" className="flex items-stretch justify-center w-full gap-2">
            <div className="flex flex-col justify-center shrink-0">
              {unequalRows.map((row, index) => (
                <div key={row.time} data-dose-time={row.time} className={`flex items-center justify-between gap-2 py-0.5 ${index < unequalRows.length - 1 ? 'border-b border-black' : ''}`}>
                  <span className="sinhala-text font-bold" style={lineStyle}>{row.text}</span>
                  <span data-dose-badge={row.time} className={BADGE}>{row.formatted}</span>
                </div>
              ))}
            </div>
            <div aria-hidden="true" className="border-l border-black -skew-x-12 mx-1" />
            <div data-digital-administration className="flex flex-col items-center justify-center min-w-0 sinhala-text">
              {lines.filter(line => line !== labelItem.weeklyPrefix && (!statInPhrase || !line.startsWith(statInPhrase.phrase))).map(renderLine)}
            </div>
          </div>
        )}

        {/* Row 1: Dosage Breakdown with Circled Badges */}
        {!unequalRows && !labelItem.consolidatedDosage && labelItem.dosage && (labelItem.dosage.morning || labelItem.dosage.lunch || labelItem.dosage.night) && (
          <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 font-extrabold text-black">
            {(['morning', 'lunch', 'night'] as const).map((k) => labelItem.dosage?.[k] && (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="sinhala-text font-bold" style={lineStyle}>{labelItem.digitalRows?.find(row => row.time === k)?.text ?? { morning: 'උදේ', lunch: 'දවල්', night: 'රෑ' }[k]}</span>
                <span className={BADGE}>{labelItem.dosage?.[k]}</span>
              </span>
            ))}
          </div>
        )}

        {/* Frequency Dosage with Circled Badge */}
        {labelItem.frequencyDosage && !labelItem.ent && !labelItem.replacesFrequencyDosage && (
          <div className="flex items-center justify-center flex-wrap font-bold text-black sinhala-text" style={lineStyle}>
            <span className={`${BADGE} mx-1.5 font-sans`}>
              {labelItem.frequencyDosage.qty}
            </span>
            <span>
              {frequencyInstruction(labelItem.frequencyDosage.freqLabel)}
            </span>
          </div>
        )}

        {/* Row 2: Sinhala Meal Timing & Administration Instructions */}
        {!unequalRows && lines.length > 0 && (
          <div className="flex flex-col items-center">
            {lines.filter(line => line !== labelItem.weeklyPrefix && (!statInPhrase || !line.startsWith(statInPhrase.phrase))).map(renderLine)}
          </div>
        )}

        {/* Row 3: Reason for Use */}
        {reasonLines.length > 0 && (
          <div data-label-reasons className="sinhala-text font-bold text-black tracking-wide leading-tight" style={{ fontSize: 'calc(var(--ins-size) - 1.5px)' }}>
            {reasonLines.map((text, index) => <div key={index} data-reason-line>{text}</div>)}
          </div>
        )}

        {/* Row 4: days, days of the week, STAT and English tags share one row that wraps when full,
            in the same reading order as before */}
        {(labelItem.days || (!labelItem.daysPrefix && labelItem.selectedDaysOfWeek?.length > 0) || showStatPill || tags.length > 0) && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
            {labelItem.days && (
              <div className="sinhala-text text-[11px] font-bold text-black tracking-wide">
                දින {labelItem.days} ක් සඳහා (FOR {labelItem.days} DAYS)
              </div>
            )}
            {(!labelItem.daysPrefix && labelItem.selectedDaysOfWeek?.length > 0) && (
              <div className="sinhala-text text-[10px] font-bold text-black tracking-wide">
                {formatDays(labelItem.selectedDaysOfWeek)}
              </div>
            )}
            {showStatPill && (
              <div className="font-black text-[10px] uppercase bg-black text-white px-2 py-0.5 rounded-sm">
                {labelItem.stat}
              </div>
            )}
            {tags.map((inst: string) => (
              <span key={inst} className="border border-black px-1 text-[8px] font-bold rounded-sm uppercase">
                {inst}
              </span>
            ))}
          </div>
        )}

      </div>

      {/* SECTION 4: Expiry, only when Add Expiry Date is selected (GRN batch date as recorded) */}
      {expDate ? (
        <div data-label-section="expiry" className="shrink-0 flex items-center justify-end pt-[0.4mm] border-t border-black leading-none">
          <span data-label-expiry className="font-extrabold text-[9px] uppercase tracking-wide whitespace-nowrap">
            EXP DATE : {expDate}
          </span>
        </div>
      ) : null}

      {/* SECTION 5: Footer: configured pharmacy details (omitted when not configured; the address
          follows Remove Address) and the issue date */}
      <div data-label-section="footer" className="shrink-0 flex flex-col items-center justify-center text-center leading-none gap-[0.4mm] pt-[0.4mm] border-t border-black">
        {(branding.name || (branding.address && !removeAddress)) && (
          <span data-label-pharmacy className="inline-flex items-baseline justify-center flex-wrap gap-x-1.5">
            {branding.name && (
              <span className="font-serif font-black text-[10.5px] tracking-wider uppercase">{branding.name}</span>
            )}
            {branding.address && !removeAddress && (
              <span data-label-address className="font-sans font-semibold text-[7.5px] tracking-tight">{branding.address}</span>
            )}
          </span>
        )}
        <span className="font-sans font-bold text-[7.5px] tracking-tight">
          {branding.phone && <span data-label-phone>{branding.phone} · </span>}
          Date: {todayStr}
        </span>
      </div>

    </div>
  );
}

/** Print rules: 70 × 50 mm pages, one label per page, Sinhala fonts. Shared with the layout check page. */
export const PRINT_LABEL_CSS = `
        @import url('https://fonts.googleapis.com/css2?family=Gemunu+Libre:wght@400;500;600;700;800&family=Noto+Sans+Sinhala:wght@400;500;600;700;800;900&display=swap');

        .sinhala-text {
          font-family: 'Gemunu Libre', 'Noto Sans Sinhala', 'Iskoola Pota', 'Nirmala UI', 'Segoe UI', Arial, sans-serif !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        @media print {
          html, body {
            width: 70mm !important;
            height: 50mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 70mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
            visibility: visible !important;
            font-family: 'Segoe UI', Arial, 'Gemunu Libre', 'Noto Sans Sinhala', sans-serif;
            color: #000000;
          }
          .print-label-page {
            width: 70mm !important;
            height: 50mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            overflow: hidden !important;
          }
          .print-label-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .print-only * {
            box-sizing: border-box !important;
          }
          @page {
            size: 70mm 50mm;
            margin: 0;
          }
        }
        /* On screen the print copy is laid out off-screen and invisible (not display: none), so long
           names are fitted to the label exactly as they will print. */
        @media screen {
          .print-only {
            position: fixed !important;
            left: -10000px !important;
            top: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        }
`;

export function PrintableLabel({ data }: { data: BuiltLabelData | BuiltLabelData[] | null }) {
  if (!data) return null;

  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return null;

  return (
    <div className="print-only" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: PRINT_LABEL_CSS }} />

      {items.map((labelItem, idx) => (
        <LabelCard key={labelItem.id || idx} labelItem={labelItem} />
      ))}
    </div>
  );
}
