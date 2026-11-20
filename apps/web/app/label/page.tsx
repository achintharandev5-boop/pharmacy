'use client';

import { uiTestEnabled, UI_TEST_NOT_SAVED } from '@/lib/uiTestMode';
import { labelFitReport } from '@/lib/labelFit';
import { clinicalPrintBlocker } from '@/lib/stagingPolicy';
import React, { useRef, useState } from 'react';
import { ReasonCatalogueLoader } from '../../components/ReasonCatalogueLoader';
import { useLabelStore, FREQUENCY_CODES, isStatStep } from '../../store/labelStore';
import { CustomerSearchPanel } from '../../components/CustomerSearchPanel';
import { PrintableLabel } from '../../components/PrintableLabel';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { createPrescriptionRecord, logPrescriptionPrint } from '../actions/prescriptions';
import { validateBeforePrint } from '../../constants/oabInstructions';
import { ENT_PREFIX, readEnt } from '../../lib/ent';
import { analyseLabel, chewingPrintError, dissolvePrintError, withFoodPrintError, keepInMouthPrintError, emptyStomachPrintError, intervalPrintError, digitalPrintError, eveningPrintError, weeklyPrintError, reasonsPrintError, daysPrintError, dailyPrintError, usbPrintError, eodPrintError, statPrintError } from '../../lib/instructionEngine';
import { firstLabelMissingQuantity } from '../../lib/labelQuantity';
import { productTypePrinting } from '../../lib/productTypePrinting';
import { expiryPrintError } from '../../lib/batchExpiry';
import type { BuiltLabelData } from '../../lib/labelBuilder';

import { ProductToolbar } from '../../components/label/ProductToolbar';
import { InstructionGrid } from '../../components/label/InstructionGrid';
import { ActionWorkspace } from '../../components/label/ActionWorkspace';
import { BottomActionBar } from '../../components/label/BottomActionBar';
import { LabelActionPage } from '../../components/label/LabelActionPage';

export default function LabelPage() {
  const customerSearchVisible = useLabelStore((state) => state.customerSearchVisible);
  const allClear = useLabelStore((state) => state.allClear);
  const selectLabel = useLabelStore((state) => state.selectLabel);

  const [finalLabelData, setFinalLabelData] = useState<BuiltLabelData[] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showActionPage, setShowActionPage] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  // One key per review session: a retry after a failed or lost response reuses it, so the
  // server can never dispense the same prescription twice.
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencyKey = () => (idempotencyKeyRef.current ??= `rx-${crypto.randomUUID()}`);

  const handleDone = () => {
    const currentState = useLabelStore.getState();
    const { labels } = currentState;
    if (isStatStep(currentState.activeControl)) { setValidationError('Confirm or cancel the STAT quantity first.'); return; }

    const missingQuantityIndex = firstLabelMissingQuantity(labels);
    if (missingQuantityIndex !== -1) {
      selectLabel(missingQuantityIndex);
      setValidationError(`Label ${missingQuantityIndex + 1}: enter the product quantity before continuing.`);
      setTimeout(() => setValidationError(null), 4000);
      return;
    }

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const labelNum = i + 1;

      // The instruction engine also decides (same analysis as the on-screen guidance): an interval
      // without its quantity, and under the spec wording any incomplete or invalid workflow or STAT dose, never
      // reaches the review page.
      const validation = validateBeforePrint(label.additionalInstructions);
      const engineMessage = reasonsPrintError(label, currentState.reasonCatalogue) ?? daysPrintError(label, currentState.activeControl === 'days_of_week' && i === currentState.activeLabelIndex) ?? weeklyPrintError(label, ['weekly', 'weekly_fraction'].includes(currentState.activeControl) && i === currentState.activeLabelIndex) ?? analyseLabel(label).blocking ?? expiryPrintError(label, { uiTest: uiTestEnabled() });
      const message = (!validation.valid && validation.message) || engineMessage;
      if (message) {
        selectLabel(i);
        setValidationError(`Label ${labelNum}: ${message}`);
        setTimeout(() => setValidationError(null), 4000);
        return;
      }
    }

    setValidationError(null);
    setSaveError(null);
    setSaveWarning(null);
    setPrintNotice(null);
    idempotencyKeyRef.current = null;
    setShowActionPage(true);
  };

  const buildPrescriptionPayload = () => {
    const currentState = useLabelStore.getState();
    const { labels, customerName, customerPhone } = currentState;

    return {
      customerName: customerName || 'Walk-in Patient',
      customerPhone: customerPhone || null,
      items: labels.map((label) => {
        const built = buildFinalInstruction({ ...label, customerName });
        const activeFrequency = label.additionalInstructions.find(i => ['8H', '6H', '5H'].includes(i))
          ?? (label.additionalInstructions || []).find((i) => FREQUENCY_CODES.includes(i)) ?? (label.additionalInstructions.includes('WEEKLY') && !Object.values(label.dosage).some(dose => dose.qty > 0) ? 'WEEKLY' : undefined);
        return {
          productId: label.product?.id || undefined,
          alternativeProductName: label.alternativeProductName || undefined,
          // Quantity must be explicitly entered before the review page can be saved.
          quantity: label.productQuantity ?? undefined,
          days: label.days || undefined,
          dosage: {
            morning: label.dosage.morning.qty || 0,
            lunch: label.dosage.lunch.qty || 0,
            night: label.dosage.night.qty || 0,
          },
          frequency: activeFrequency ?? (!label.additionalInstructions.some(code => ['EOD', 'WEEKLY'].includes(code)) && label.frequencyDosage.qty > 0 ? 'FREQUENCY' : undefined),
          weekly: label.additionalInstructions.includes('WEEKLY') && label.weeklyDosage ? { ...label.weeklyDosage } : undefined,
          frequencyQty: activeFrequency === 'WEEKLY' ? label.weeklyDosage?.qty : (activeFrequency || !label.additionalInstructions.some(code => ['EOD', 'WEEKLY'].includes(code))) && label.frequencyDosage.qty > 0 ? label.frequencyDosage.qty : undefined,
          stat: label.stat ? { qty: label.stat.qty, isFraction: label.stat.isFraction, followUp: label.stat.followUp || undefined } : undefined,
          // The printed batch expiry (only when Add Expiry Date is selected) and its GRN batch,
          // which the API checks again against the database before saving.
          expiryDate: built.expiryDate || undefined,
          expiryBatchId: built.expiryDate && label.expiryBatch?.source === 'inventory' ? label.expiryBatch.id ?? undefined : undefined,
          instructions: (label.additionalInstructions || []).filter(i => !i.startsWith(ENT_PREFIX)),
          ent: readEnt(label.additionalInstructions) || undefined,
          reasons: label.reasons || (label.reason ? [label.reason] : []),
          selectedDaysOfWeek: label.selectedDaysOfWeek || [],
          weekdayRange: label.weekdayRange ? { ...label.weekdayRange } : undefined,
          showAddress: label.showAddress !== false,
          // The dosage and instruction text the workstation generated for this label.
          finalInstructionText: built.finalInstructionText || undefined,
        };
      }),
    };
  };

  const handleSave = async () => {
    if (isProcessing) return;
    const reasonState = useLabelStore.getState();
    const reasonIndex = reasonState.labels.findIndex(label => reasonsPrintError(label, reasonState.reasonCatalogue));
    if (reasonIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${reasonIndex + 1}: ${reasonsPrintError(reasonState.labels[reasonIndex], reasonState.reasonCatalogue)}`);
      return;
    }
    const dayState = useLabelStore.getState();
    const dayIndex = dayState.labels.findIndex((label, index) => daysPrintError(label, dayState.activeControl === 'days_of_week' && index === dayState.activeLabelIndex));
    if (dayIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${dayIndex + 1}: ${daysPrintError(dayState.labels[dayIndex], dayState.activeControl === 'days_of_week' && dayIndex === dayState.activeLabelIndex)}`);
      return;
    }
    const weeklyState = useLabelStore.getState();
    const weeklyLabels = weeklyState.labels;
    const weeklyErrorIndex = weeklyLabels.findIndex((label, index) => weeklyPrintError(label, ['weekly', 'weekly_fraction'].includes(weeklyState.activeControl) && index === weeklyState.activeLabelIndex));
    if (weeklyErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${weeklyErrorIndex + 1}: ${weeklyPrintError(weeklyLabels[weeklyErrorIndex], ['weekly', 'weekly_fraction'].includes(weeklyState.activeControl) && weeklyErrorIndex === weeklyState.activeLabelIndex)}`);
      return;
    }
    const dailyLabels = useLabelStore.getState().labels;
    const dailyErrorIndex = dailyLabels.findIndex(label => dailyPrintError(label));
    if (dailyErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${dailyErrorIndex + 1}: ${dailyPrintError(dailyLabels[dailyErrorIndex])}`);
      return;
    }
    const eveningLabels = useLabelStore.getState().labels;
    const eveningErrorIndex = eveningLabels.findIndex(label => eveningPrintError(label));
    if (eveningErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${eveningErrorIndex + 1}: ${eveningPrintError(eveningLabels[eveningErrorIndex])}`);
      return;
    }
    const digitalLabels = useLabelStore.getState().labels;
    const digitalErrorIndex = digitalLabels.findIndex(label => digitalPrintError(label));
    if (digitalErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${digitalErrorIndex + 1}: ${digitalPrintError(digitalLabels[digitalErrorIndex])}`);
      return;
    }
    const intervalLabels = useLabelStore.getState().labels;
    const intervalErrorIndex = intervalLabels.findIndex(label => intervalPrintError(label));
    if (intervalErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${intervalErrorIndex + 1}: ${intervalPrintError(intervalLabels[intervalErrorIndex])}`);
      return;
    }
    const latestStatState = useLabelStore.getState();
    const statErrorIndex = latestStatState.labels.findIndex((label, index) => statPrintError(label, isStatStep(latestStatState.activeControl) && index === latestStatState.activeLabelIndex));
    if (statErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${statErrorIndex + 1}: ${statPrintError(latestStatState.labels[statErrorIndex], isStatStep(latestStatState.activeControl) && statErrorIndex === latestStatState.activeLabelIndex)}`);
      return;
    }
    const eodErrorIndex = useLabelStore.getState().labels.findIndex(label => eodPrintError(label));
    if (eodErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${eodErrorIndex + 1}: ${eodPrintError(useLabelStore.getState().labels[eodErrorIndex])}`);
      return;
    }
    const emptyStomachErrorIndex = useLabelStore.getState().labels.findIndex(label => emptyStomachPrintError(label));
    if (emptyStomachErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${emptyStomachErrorIndex + 1}: ${emptyStomachPrintError(useLabelStore.getState().labels[emptyStomachErrorIndex])}`);
      return;
    }
    const mouthErrorIndex = useLabelStore.getState().labels.findIndex(label => keepInMouthPrintError(label));
    if (mouthErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${mouthErrorIndex + 1}: ${keepInMouthPrintError(useLabelStore.getState().labels[mouthErrorIndex])}`);
      return;
    }
    const withFoodErrorIndex = useLabelStore.getState().labels.findIndex(label => withFoodPrintError(label));
    if (withFoodErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${withFoodErrorIndex + 1}: ${withFoodPrintError(useLabelStore.getState().labels[withFoodErrorIndex])}`);
      return;
    }
    const dissolveErrorIndex = useLabelStore.getState().labels.findIndex(label => dissolvePrintError(label));
    if (dissolveErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${dissolveErrorIndex + 1}: ${dissolvePrintError(useLabelStore.getState().labels[dissolveErrorIndex])}`);
      return;
    }
    const usbErrorIndex = useLabelStore.getState().labels.findIndex(label => usbPrintError(label));
    if (usbErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${usbErrorIndex + 1}: ${usbPrintError(useLabelStore.getState().labels[usbErrorIndex])}`);
      return;
    }
    const expiryLabels = useLabelStore.getState().labels;
    const expiryErrorIndex = expiryLabels.findIndex(label => expiryPrintError(label, { uiTest: uiTestEnabled() }));
    if (expiryErrorIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${expiryErrorIndex + 1}: ${expiryPrintError(expiryLabels[expiryErrorIndex], { uiTest: uiTestEnabled() })}`);
      return;
    }
    const missingQuantityIndex = firstLabelMissingQuantity(useLabelStore.getState().labels);
    if (missingQuantityIndex !== -1) {
      setSaveError(`Not saved: label ${missingQuantityIndex + 1} needs an explicitly entered product quantity.`);
      return;
    }
    setIsProcessing(true);
    setSaveError(null);

    const payload = buildPrescriptionPayload();

    try {
      const res = await createPrescriptionRecord(payload, idempotencyKey());
      if (!res.ok) {
        setSaveError(`Not saved: ${res.error}`);
        return;
      }

      idempotencyKeyRef.current = null;
      allClear();
      setShowActionPage(false);
    } catch {
      setSaveError('Not saved: the pharmacy server could not be reached. Try again; it will not be saved twice.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    if (isProcessing) return;
    allClear();
    setShowActionPage(false);
  };

  /**
   * Why the labels cannot be printed, or null. The label checks of Print & Save, in the same order;
   * shared with print-only. Saving and dispensing keep their own additional checks (API).
   */
  const printBlocker = (): string | null => {
    const reasonState = useLabelStore.getState();
    const reasonIndex = reasonState.labels.findIndex(label => reasonsPrintError(label, reasonState.reasonCatalogue));
    if (reasonIndex !== -1) {
      return (`label ${reasonIndex + 1}: ${reasonsPrintError(reasonState.labels[reasonIndex], reasonState.reasonCatalogue)}`);
    }
    const dayState = useLabelStore.getState();
    const dayIndex = dayState.labels.findIndex((label, index) => daysPrintError(label, dayState.activeControl === 'days_of_week' && index === dayState.activeLabelIndex));
    if (dayIndex !== -1) {
      return (`label ${dayIndex + 1}: ${daysPrintError(dayState.labels[dayIndex], dayState.activeControl === 'days_of_week' && dayIndex === dayState.activeLabelIndex)}`);
    }
    const weeklyState = useLabelStore.getState();
    const weeklyLabels = weeklyState.labels;
    const weeklyErrorIndex = weeklyLabels.findIndex((label, index) => weeklyPrintError(label, ['weekly', 'weekly_fraction'].includes(weeklyState.activeControl) && index === weeklyState.activeLabelIndex));
    if (weeklyErrorIndex !== -1) {
      return (`label ${weeklyErrorIndex + 1}: ${weeklyPrintError(weeklyLabels[weeklyErrorIndex], ['weekly', 'weekly_fraction'].includes(weeklyState.activeControl) && weeklyErrorIndex === weeklyState.activeLabelIndex)}`);
    }
    const dailyLabels = useLabelStore.getState().labels;
    const dailyErrorIndex = dailyLabels.findIndex(label => dailyPrintError(label));
    if (dailyErrorIndex !== -1) {
      return (`label ${dailyErrorIndex + 1}: ${dailyPrintError(dailyLabels[dailyErrorIndex])}`);
    }
    const eveningLabels = useLabelStore.getState().labels;
    const eveningErrorIndex = eveningLabels.findIndex(label => eveningPrintError(label));
    if (eveningErrorIndex !== -1) {
      return (`label ${eveningErrorIndex + 1}: ${eveningPrintError(eveningLabels[eveningErrorIndex])}`);
    }
    const digitalLabels = useLabelStore.getState().labels;
    const digitalErrorIndex = digitalLabels.findIndex(label => digitalPrintError(label));
    if (digitalErrorIndex !== -1) {
      return (`label ${digitalErrorIndex + 1}: ${digitalPrintError(digitalLabels[digitalErrorIndex])}`);
    }
    const intervalLabels = useLabelStore.getState().labels;
    const intervalErrorIndex = intervalLabels.findIndex(label => intervalPrintError(label));
    if (intervalErrorIndex !== -1) {
      return (`label ${intervalErrorIndex + 1}: ${intervalPrintError(intervalLabels[intervalErrorIndex])}`);
    }
    const latestStatState = useLabelStore.getState();
    const statErrorIndex = latestStatState.labels.findIndex((label, index) => statPrintError(label, isStatStep(latestStatState.activeControl) && index === latestStatState.activeLabelIndex));
    if (statErrorIndex !== -1) {
      return (`label ${statErrorIndex + 1}: ${statPrintError(latestStatState.labels[statErrorIndex], isStatStep(latestStatState.activeControl) && statErrorIndex === latestStatState.activeLabelIndex)}`);
    }
    const eodErrorIndex = useLabelStore.getState().labels.findIndex(label => eodPrintError(label));
    if (eodErrorIndex !== -1) {
      return (`label ${eodErrorIndex + 1}: ${eodPrintError(useLabelStore.getState().labels[eodErrorIndex])}`);
    }
    const emptyStomachErrorIndex = useLabelStore.getState().labels.findIndex(label => emptyStomachPrintError(label));
    if (emptyStomachErrorIndex !== -1) {
      return (`label ${emptyStomachErrorIndex + 1}: ${emptyStomachPrintError(useLabelStore.getState().labels[emptyStomachErrorIndex])}`);
    }
    const mouthErrorIndex = useLabelStore.getState().labels.findIndex(label => keepInMouthPrintError(label));
    if (mouthErrorIndex !== -1) {
      return (`label ${mouthErrorIndex + 1}: ${keepInMouthPrintError(useLabelStore.getState().labels[mouthErrorIndex])}`);
    }
    const withFoodErrorIndex = useLabelStore.getState().labels.findIndex(label => withFoodPrintError(label));
    if (withFoodErrorIndex !== -1) {
      return (`label ${withFoodErrorIndex + 1}: ${withFoodPrintError(useLabelStore.getState().labels[withFoodErrorIndex])}`);
    }
    const dissolveErrorIndex = useLabelStore.getState().labels.findIndex(label => dissolvePrintError(label));
    if (dissolveErrorIndex !== -1) {
      return (`label ${dissolveErrorIndex + 1}: ${dissolvePrintError(useLabelStore.getState().labels[dissolveErrorIndex])}`);
    }
    const chewingErrorIndex = useLabelStore.getState().labels.findIndex(label => chewingPrintError(label));
    if (chewingErrorIndex !== -1) {
      return (`label ${chewingErrorIndex + 1}: ${chewingPrintError(useLabelStore.getState().labels[chewingErrorIndex])}`);
    }
    const typeErrorIndex = useLabelStore.getState().labels.findIndex(label => productTypePrinting(label).error);
    if (typeErrorIndex !== -1) {
      return (`label ${typeErrorIndex + 1}: ${productTypePrinting(useLabelStore.getState().labels[typeErrorIndex]).error}`);
    }
    const usbErrorIndex = useLabelStore.getState().labels.findIndex(label => usbPrintError(label));
    if (usbErrorIndex !== -1) {
      return (`label ${usbErrorIndex + 1}: ${usbPrintError(useLabelStore.getState().labels[usbErrorIndex])}`);
    }
    const expiryLabels = useLabelStore.getState().labels;
    const expiryErrorIndex = expiryLabels.findIndex(label => expiryPrintError(label, { uiTest: uiTestEnabled() }));
    if (expiryErrorIndex !== -1) {
      return (`label ${expiryErrorIndex + 1}: ${expiryPrintError(expiryLabels[expiryErrorIndex], { uiTest: uiTestEnabled() })}`);
    }
    const missingQuantityIndex = firstLabelMissingQuantity(useLabelStore.getState().labels);
    if (missingQuantityIndex !== -1) {
      return (`label ${missingQuantityIndex + 1} needs an explicitly entered product quantity.`);
    }
    return null;
  };

  const handlePrintAndSave = async () => {
    const stagingBlocker = clinicalPrintBlocker();
    if (stagingBlocker) { setSaveError(stagingBlocker); return; }
    if (isProcessing) return;
    const problem = printBlocker();
    if (problem) {
      setSaveError(`Not saved, nothing printed: ${problem}`);
      return;
    }
    setIsProcessing(true);
    setSaveError(null);

    const currentState = useLabelStore.getState();
    const { labels, customerName } = currentState;

    const allFinalData = labels.map((l) => buildFinalInstruction({ ...l, customerName }));
    setFinalLabelData(allFinalData);

    const payload = buildPrescriptionPayload();

    try {
      if (uiTestEnabled()) {
        await document.fonts?.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (labelFitReport(document).length) {
          setSaveError('Print preview blocked: label text does not fit the 70 × 50 mm label.');
          setFinalLabelData(null);
          return;
        }
        setSaveError(UI_TEST_NOT_SAVED + ' Print layout preview only.');
        window.print();
        // As after a real print: never leave a print-only copy that could be printed after edits.
        setFinalLabelData(null);
        return;
      }
      // Print only after the server has confirmed the prescription is saved.
      const res = await createPrescriptionRecord(payload, idempotencyKey());
      if (!res.ok) {
        setSaveError(`Not saved, nothing printed: ${res.error}`);
        setFinalLabelData(null);
        return;
      }
      idempotencyKeyRef.current = null;
      const saved = res.data;

      // Let the printable labels render, and the Sinhala print font load, before the print dialog:
      // printing earlier would lay the label out in a fallback font with different line heights.
      await new Promise((resolve) => setTimeout(resolve, 150));
      await document.fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();

      const logged = await logPrescriptionPrint(saved.id);
      allClear();
      setFinalLabelData(null);
      setShowActionPage(false);
      if (!logged.ok) {
        setSaveWarning(
          `Prescription ${saved.prescriptionNumber} was saved and sent to the printer, but the print could not be recorded: ${logged.error}`,
        );
      }
    } catch {
      setSaveError('Not saved, nothing printed: the pharmacy server could not be reached. Try again; it will not be saved twice.');
      setFinalLabelData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Print label only (not saved): a standalone 70 × 50 mm instruction label. Patient and medicine
  // names are optional here (omitted from the label when empty). It never creates a prescription,
  // deducts stock or logs a print; Save and Print & Save keep every identity and inventory check.
  const handlePrintOnly = async () => {
    const stagingBlocker = clinicalPrintBlocker();
    if (stagingBlocker) { setSaveError(stagingBlocker); return; }
    if (isProcessing) return;
    const problem = printBlocker();
    if (problem) {
      setPrintNotice(null);
      setSaveError(`Nothing printed: ${problem}`);
      return;
    }
    setIsProcessing(true);
    setSaveError(null);
    setPrintNotice(null);
    const { labels, customerName } = useLabelStore.getState();
    setFinalLabelData(labels.map((l) => buildFinalInstruction({ ...l, customerName })));
    try {
      // Let the print copy render and the Sinhala font load before measuring and printing.
      await new Promise((resolve) => setTimeout(resolve, 150));
      await document.fonts?.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (labelFitReport(document).length) {
        setSaveError('Nothing printed: label text does not fit the 70 × 50 mm label.');
        return;
      }
      window.print();
      setPrintNotice('Label printed only. Nothing was saved, no stock was deducted and no print was recorded.');
    } finally {
      // As after any print: no print-only copy is left that could be printed after edits.
      setFinalLabelData(null);
      setIsProcessing(false);
    }
  };

  if (showActionPage) {
    return (
      <>
        <PrintableLabel data={finalLabelData} />
        <div className="no-print w-full h-full">
          {printNotice && !saveError && (
            <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary-soft border border-primary-border text-primary px-5 py-3 font-semibold text-sm shadow-pop flex items-center gap-3 rounded-ui-lg">
              <span>{printNotice}</span>
              <button type="button" onClick={() => setPrintNotice(null)} className="font-bold text-xs underline">Dismiss</button>
            </div>
          )}
          {saveError && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-danger-soft border-2 border-danger text-danger px-6 py-3 font-bold text-base shadow-pop flex items-center gap-3 rounded-ui-lg">
              <span>⚠️</span>
              <span>{saveError}</span>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="ml-4 font-bold text-xs bg-danger text-[var(--color-on-solid)] px-2 py-1 rounded-lg"
              >
                DISMISS
              </button>
            </div>
          )}
          <LabelActionPage
            onSave={handleSave}
            onDelete={handleDelete}
            onPrintAndSave={handlePrintAndSave}
            onPrintOnly={handlePrintOnly}
            onBack={() => setShowActionPage(false)}
            isProcessing={isProcessing}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="no-print"><ReasonCatalogueLoader /></div>
      <PrintableLabel data={finalLabelData} />
      <div className="no-print w-full h-full overflow-x-clip lg:overflow-x-visible">
        {saveWarning && (
          <div
            role="alert"
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[calc(100%-2rem)] bg-warning-soft border border-warning-border text-warning px-4 py-3 text-sm font-semibold rounded-lg shadow-pop flex items-start gap-3"
          >
            <span className="flex-1">{saveWarning}</span>
            <button type="button" onClick={() => setSaveWarning(null)} className="font-bold underline shrink-0">
              Dismiss
            </button>
          </div>
        )}
        {customerSearchVisible && <CustomerSearchPanel />}

        {/* Below 1024 px the sections stack and the page scrolls (DONE stays reachable in a sticky
            footer); from 1024 px the workstation fills the space under the optional UI-test banner.
            Nothing is clipped to make it fit: the middle row takes the height the header and footer
            leave, and --ws-ctl sizes the large touch controls from the viewport height. */}
        <main className="w-full min-h-[100dvh] lg:min-h-0 lg:h-[calc(100dvh-var(--ui-test-banner-h,0px))] bg-[var(--color-canvas)] flex flex-col gap-2 p-2 text-fg select-none touch-manipulation font-sans [--ws-ctl:3.5rem] lg:[--ws-ctl:clamp(2.75rem,7dvh,4.25rem)]">
          <h1 className="sr-only">Label workstation</h1>
          {/* 1. TOP TOOLBAR */}
          <ProductToolbar />

          {/* 2. MAIN WORKSPACE: left = selected instructions + 5 × 4 feature grid; right = quantity
              editor (or the open action's panel) + administration */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2 lg:flex-1 lg:min-h-0">
            <div className="flex flex-col min-w-0 lg:min-h-0">
              <InstructionGrid validationError={validationError} />
            </div>

            <div id="workstation-right" className="flex flex-col gap-2 min-w-0 lg:min-h-0 scroll-mt-2">
              <ActionWorkspace />
            </div>
          </div>

          {/* 3. BOTTOM ACTION BAR */}
          <BottomActionBar onDone={handleDone} />
        </main>
      </div>
    </>
  );
}
