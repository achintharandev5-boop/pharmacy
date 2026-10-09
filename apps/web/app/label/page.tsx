'use client';

import React, { useRef, useState } from 'react';
import { useLabelStore } from '../../store/labelStore';
import { CustomerSearchPanel } from '../../components/CustomerSearchPanel';
import { PrintableLabel } from '../../components/PrintableLabel';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { createPrescriptionRecord, logPrescriptionPrint } from '../actions/prescriptions';
import { validateBeforePrint } from '../../constants/oabInstructions';

/** Frequency buttons, as recognised by the label builder. */
const FREQUENCY_CODES = ['STAT', 'SOS', '6H', '8H', '5H', 'EOD', 'DAILY', 'EVENING'];

import { ProductToolbar } from '../../components/label/ProductToolbar';
import { InstructionGrid } from '../../components/label/InstructionGrid';
import { DosagePanel } from '../../components/label/DosagePanel';
import { LabelActions } from '../../components/label/LabelActions';
import { BottomActionBar } from '../../components/label/BottomActionBar';
import { LabelActionPage } from '../../components/label/LabelActionPage';
import { DeleteLabelModal } from '../../components/label/DeleteLabelModal';
import { ExpDateModal } from '../../components/label/ExpDateModal';

export default function LabelPage() {
  const customerSearchVisible = useLabelStore((state) => state.customerSearchVisible);
  const allClear = useLabelStore((state) => state.allClear);
  const selectLabel = useLabelStore((state) => state.selectLabel);

  const [finalLabelData, setFinalLabelData] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showActionPage, setShowActionPage] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  // One key per review session: a retry after a failed or lost response reuses it, so the
  // server can never dispense the same prescription twice.
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencyKey = () => (idempotencyKeyRef.current ??= `rx-${crypto.randomUUID()}`);

  const handleDone = () => {
    const currentState = useLabelStore.getState();
    const { labels } = currentState;

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const labelNum = i + 1;

      const validation = validateBeforePrint(label.additionalInstructions);
      if (!validation.valid && validation.message) {
        selectLabel(i);
        setValidationError(`Label ${labelNum}: ${validation.message}`);
        setTimeout(() => setValidationError(null), 4000);
        return;
      }
    }

    setValidationError(null);
    setSaveError(null);
    setSaveWarning(null);
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
        const activeFrequency = (label.additionalInstructions || []).find((i) => FREQUENCY_CODES.includes(i));
        return {
          productId: label.product?.id || undefined,
          alternativeProductName: label.alternativeProductName || undefined,
          // Existing behaviour: a label without an entered quantity is saved as 1 unit.
          // Flagged for pharmacist review (docs/BACKEND_AUDIT_AND_REPAIR_REPORT.md).
          quantity: label.productQuantity || 1,
          days: label.days || undefined,
          dosage: {
            morning: label.dosage.morning.qty || 0,
            lunch: label.dosage.lunch.qty || 0,
            night: label.dosage.night.qty || 0,
          },
          frequency: activeFrequency ?? (label.frequencyDosage.qty > 0 ? 'FREQUENCY' : undefined),
          frequencyQty: label.frequencyDosage.qty > 0 ? label.frequencyDosage.qty : undefined,
          stat: label.stat ? { qty: label.stat.qty, isFraction: label.stat.isFraction, followUp: label.stat.followUp || undefined } : undefined,
          expiryDate: label.expiryDate || undefined,
          instructions: label.additionalInstructions || [],
          reasons: label.reasons || (label.reason ? [label.reason] : []),
          selectedDaysOfWeek: label.selectedDaysOfWeek || [],
          showAddress: label.showAddress !== false,
          // The dosage and instruction text the workstation generated for this label.
          finalInstructionText: [built.dosageText, built.instructionString].filter(Boolean).join(' | ') || undefined,
        };
      }),
    };
  };

  const handleSave = async () => {
    if (isProcessing) return;
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

  const handlePrintAndSave = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setSaveError(null);

    const currentState = useLabelStore.getState();
    const { labels, customerName } = currentState;

    const allFinalData = labels.map((l) => buildFinalInstruction({ ...l, customerName }));
    setFinalLabelData(allFinalData);

    const payload = buildPrescriptionPayload();

    try {
      // Print only after the server has confirmed the prescription is saved.
      const res = await createPrescriptionRecord(payload, idempotencyKey());
      if (!res.ok) {
        setSaveError(`Not saved, nothing printed: ${res.error}`);
        setFinalLabelData(null);
        return;
      }
      idempotencyKeyRef.current = null;
      const saved = res.data;

      // Let the printable labels render before opening the print dialog.
      await new Promise((resolve) => setTimeout(resolve, 150));
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

  if (showActionPage) {
    return (
      <>
        <PrintableLabel data={finalLabelData} />
        <div className="no-print w-full h-full">
          {saveError && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#FFF1F2] border-2 border-[#E11D48] text-[#9F1239] px-6 py-3 font-bold text-base shadow-2xl flex items-center gap-3 rounded-2xl">
              <span>⚠️</span>
              <span>{saveError}</span>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="ml-4 font-bold text-xs bg-[#E11D48] text-white px-2 py-1 rounded-lg"
              >
                DISMISS
              </button>
            </div>
          )}
          <LabelActionPage
            onSave={handleSave}
            onDelete={handleDelete}
            onPrintAndSave={handlePrintAndSave}
            onBack={() => setShowActionPage(false)}
            isProcessing={isProcessing}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PrintableLabel data={finalLabelData} />
      <div className="no-print w-full h-full">
        {saveWarning && (
          <div
            role="alert"
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[calc(100%-2rem)] bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 text-sm font-semibold rounded-lg shadow-lg flex items-start gap-3"
          >
            <span className="flex-1">{saveWarning}</span>
            <button type="button" onClick={() => setSaveWarning(null)} className="font-bold underline shrink-0">
              Dismiss
            </button>
          </div>
        )}
        {customerSearchVisible && <CustomerSearchPanel />}
        <DeleteLabelModal />
        <ExpDateModal />

        <main className="w-screen h-screen h-[100dvh] bg-[#F4F8FF] overflow-hidden flex flex-col p-2.5 text-[#0F172A] select-none touch-manipulation font-sans">
          {/* 1. TOP TOOLBAR (84px height) */}
          <ProductToolbar />

          {/* 2. MAIN WORKSPACE (53.5% Left / 46.5% Right, gap 10px) */}
          <div
            className="flex-1 min-h-0 w-full grid gap-2.5 overflow-hidden my-2"
            style={{
              gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
            }}
          >
            {/* LEFT PANEL: Selected Instructions + Categories + 5x4 Grid + Name of Days */}
            <div className="h-full flex flex-col min-w-0 overflow-hidden">
              <InstructionGrid validationError={validationError} />
            </div>

            {/* RIGHT PANEL: Dosage Schedule + Administration */}
            <div className="h-full flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden">
              {/* Dosage Rows (Morning, Lunch, Night) */}
              <DosagePanel />

              {/* Administration & Timing (Give, Take, Before, After) */}
              <LabelActions />
            </div>
          </div>

          {/* 3. BOTTOM ACTION BAR (76px height) */}
          <BottomActionBar onDone={handleDone} />
        </main>
      </div>
    </>
  );
}
