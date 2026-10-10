'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Printer,
  Save,
  Trash2,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Pill,
  User,
  Phone,
  MapPin,
  Clock,
  X,
  FileCheck2,
} from 'lucide-react';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { LabelCard } from '../PrintableLabel';
import { sendClientSms } from '../../app/actions/sms';

interface LabelActionPageProps {
  onSave: () => void;
  onDelete: () => void;
  onPrintAndSave: () => void;
  onBack: () => void;
  isProcessing?: boolean;
}

export function LabelActionPage({
  onSave,
  onDelete,
  onPrintAndSave,
  onBack,
  isProcessing = false,
}: LabelActionPageProps) {
  const customerName = useLabelStore((state) => state.customerName);
  const customerPhone = useLabelStore((state) => state.customerPhone);
  const setCustomerPhone = useLabelStore((state) => state.setCustomerPhone);
  const labels = useLabelStore((state) => state.labels);

  const summaries = labels.map((labelState) => buildFinalInstruction({ ...labelState, customerName }));

  // SMS Modal State
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsStatus, setSmsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleOpenSmsModal = () => {
    setSmsRecipient(customerPhone || '');
    setSmsStatus(null);

    // Build default prescription message
    let msg = `SISILA CHEMIST\n`;
    if (customerName) msg += `Patient: ${customerName}\n`;
    summaries.forEach((s, i) => {
      msg += `\nMed ${i + 1}: ${s.productName || s.alternativeProductName || 'Medicine'}`;
      if (s.productQuantity) msg += ` (Qty: ${s.productQuantity})`;
      if (s.dosageText) msg += `\nDosage: ${s.dosageText}`;
      if (s.instructionString) msg += `\nInstructions: ${s.instructionString}`;
      if (s.reason) msg += `\nReason: ${s.reason}`;
    });
    msg += `\n\nThank you for choosing Sisila Chemist! Get well soon.\nTel: 011 265 88 88 / Mob: 0777 636 500`;

    setSmsMessage(msg.trim());
    setSmsModalOpen(true);
  };

  const handleSendSms = async () => {
    if (!smsRecipient.trim()) {
      setSmsStatus({ type: 'error', message: 'Please enter a recipient phone number.' });
      return;
    }

    if (!smsMessage.trim()) {
      setSmsStatus({ type: 'error', message: 'SMS message cannot be empty.' });
      return;
    }

    setSmsLoading(true);
    setSmsStatus(null);

    try {
      const res = await sendClientSms({
        recipient: smsRecipient.trim(),
        message: smsMessage.trim(),
      });

      if (res.success) {
        setCustomerPhone(smsRecipient.trim());
        setSmsStatus({ type: 'success', message: 'SMS accepted by the gateway for delivery.' });
        setTimeout(() => {
          setSmsModalOpen(false);
          setSmsStatus(null);
        }, 2000);
      } else {
        setSmsStatus({ type: 'error', message: res.error || 'Failed to send SMS.' });
      }
    } catch (err: any) {
      setSmsStatus({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between p-4 sm:p-6 lg:p-7 select-none font-sans text-fg relative selection:bg-primary-border selection:text-primary">
      <div className="relative z-10 max-w-6xl mx-auto w-full space-y-5">
        {/* 1. TOP HEADER */}
        <div className="bg-page border border-border/70 rounded-ui-lg p-5 sm:p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-ui-lg bg-primary flex items-center justify-center text-white shrink-0">
              <FileCheck2 className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">
                Final Prescription Review
              </h1>
              <p className="text-xs sm:text-[13px] font-medium text-subtle mt-0.5">
                Review all generated medicine labels and dosage instructions before printing or saving.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-surface text-muted rounded-ui-lg font-bold text-xs border border-border shadow-2xs transition-all active:scale-[0.98] self-start sm:self-auto cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-primary" />
            <span>Back to Edit</span>
          </button>
        </div>

        {/* 2. PATIENT & ORDER SUMMARY BANNER */}
        <div className="bg-primary-soft border border-primary-border/60 rounded-ui-lg p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-white font-black text-sm flex items-center justify-center shadow-xs ring-2 ring-primary-border shrink-0">
              {(customerName || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-subtle uppercase tracking-wider block leading-tight">
                Patient / Customer
              </span>
              <span className="text-base sm:text-lg font-bold text-fg leading-tight">
                {customerName || 'Walk-in Customer'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-ui-lg bg-white border border-border/80 shadow-2xs">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-subtle">Phone:</span>
              <span className="text-xs font-mono font-bold text-fg">
                {customerPhone || 'Not Provided'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-ui-lg bg-primary-soft text-primary border border-primary-border/60 font-bold text-xs">
              <Pill className="w-3.5 h-3.5" />
              <span>
                {summaries.length} {summaries.length === 1 ? 'Label' : 'Labels'} Prepared
              </span>
            </div>
          </div>
        </div>

        {/* 3. MULTI-LABEL SUMMARY CARDS WITH 1:1 PRINT PREVIEW */}
        <div className="space-y-4">
          {summaries.map((summary, idx) => (
            <div
              key={summary.id || idx}
              className="bg-page border border-border/70 rounded-ui-lg p-5 sm:p-6 shadow-card flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between transition-all"
            >
              {/* LEFT SIDE: Prescription breakdown details */}
              <div className="flex-1 flex flex-col gap-4 w-full">
                {/* Card Title & Address Badge */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-primary-border/70 text-xs font-bold">
                      <Pill className="w-3.5 h-3.5" />
                      <span>Label {idx + 1} of {summaries.length}</span>
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      summary.showAddress
                        ? 'bg-success-soft text-success border-success-border'
                        : 'bg-surface-2 text-muted border-border'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    <span>{summary.showAddress ? 'Address Included' : 'Address Removed'}</span>
                  </span>
                </div>

                {/* Prescribed Drug & Alternative Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-ui-lg bg-surface/70 border border-border">
                    <span className="text-[10.5px] font-bold text-subtle block uppercase tracking-wider mb-1">
                      Prescribed Medicine
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-bold text-fg leading-snug">
                        {summary.productName || 'Not Selected'}
                      </span>
                      {summary.productQuantity && (
                        <span className="px-2 py-0.5 rounded-md bg-primary-soft text-primary border border-primary-border text-xs font-mono font-bold">
                          Qty: {summary.productQuantity}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-ui-lg bg-surface/70 border border-border">
                    <span className="text-[10.5px] font-bold text-subtle block uppercase tracking-wider mb-1">
                      Dispensed / Alternative Brand
                    </span>
                    <span className="text-base sm:text-lg font-bold text-fg leading-snug block">
                      {summary.alternativeProductName || summary.productName || 'Same as Prescribed'}
                    </span>
                  </div>
                </div>

                {/* Dosage Breakdown */}
                {summary.dosageText && (
                  <div className="flex items-center gap-2 p-2.5 rounded-ui-lg bg-primary-soft/50 border border-primary-border/70 text-xs">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-subtle">Dosage Schedule:</span>
                    <span className="font-bold text-fg">{summary.dosageText}</span>
                  </div>
                )}

                {/* Generated Instruction Label Box */}
                <div>
                  <span className="text-[10.5px] font-bold text-subtle block uppercase tracking-wider mb-1.5">
                    Generated Patient Instructions
                  </span>
                  <div className="p-3.5 bg-surface/80 border border-border/80 rounded-ui-lg text-[15px] font-bold text-fg leading-relaxed sinhala-text shadow-2xs">
                    {summary.instructionString || 'No instruction generated.'}
                  </div>
                </div>

                {/* Expiry Date */}
                {summary.expiryDate && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger-soft border border-danger-border/70 text-danger font-mono font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>EXP: {summary.expiryDate}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: 1:1 Actual 8cm x 8cm Print Preview */}
              <div className="shrink-0 flex flex-col items-center self-center xl:self-start pt-2 xl:pt-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-subtle uppercase tracking-wider mb-2">
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>Actual 8cm × 8cm Print Preview</span>
                </div>
                <div className="rounded-ui-lg shadow-card border border-border/90 bg-white overflow-hidden p-1">
                  <LabelCard labelItem={summary} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 4. BOTTOM ACTION BUTTON BAR */}
        <div className="bg-page rounded-ui-lg border border-border/70 p-3.5 sm:p-4 shadow-card grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. SAVE DRAFT */}
          <button
            type="button"
            onClick={onSave}
            disabled={isProcessing}
            className="h-[52px] rounded-ui-lg font-bold text-xs sm:text-sm bg-white hover:bg-surface active:bg-surface-2 text-muted border border-border/90 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-subtle" />
            <span>Save Draft</span>
          </button>

          {/* 2. DELETE */}
          <button
            type="button"
            onClick={onDelete}
            disabled={isProcessing}
            className="h-[52px] rounded-ui-lg font-bold text-xs sm:text-sm bg-danger-soft hover:bg-danger-soft active:bg-danger-border text-danger border border-danger-border/80 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 text-danger" />
            <span>Delete</span>
          </button>

          {/* 3. SEND SMS */}
          <button
            type="button"
            onClick={handleOpenSmsModal}
            disabled={isProcessing}
            className="h-[52px] rounded-ui-lg font-bold text-xs sm:text-sm bg-white hover:bg-primary-soft text-primary border border-primary-border transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send SMS</span>
          </button>

          {/* 4. PRINT AND SAVE (HERO PRIMARY) */}
          <button
            type="button"
            onClick={onPrintAndSave}
            disabled={isProcessing}
            className="h-[52px] rounded-ui-lg font-extrabold text-xs sm:text-sm bg-primary hover:bg-primary-hover text-white transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print & Save</span>
          </button>
        </div>
      </div>

      {/* 5. SMS MODAL POPUP */}
      {smsModalOpen && (
        <div className="fixed inset-0 z-50 bg-fg/40 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
          <div className="bg-white w-[min(540px,94vw)] border border-border rounded-ui-lg shadow-pop overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="h-[60px] bg-primary text-white px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center border border-white/30 shadow-2xs">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold tracking-tight">
                  Send SMS Prescription to Client
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSmsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 flex flex-col gap-4">
              {/* Recipient Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted flex items-center justify-between">
                  <span>Recipient Phone Number</span>
                  <span className="text-[11px] font-normal text-subtle">Sri Lanka format</span>
                </label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 absolute left-3.5 text-subtle pointer-events-none" />
                  <input
                    type="tel"
                    value={smsRecipient}
                    onChange={(e) => setSmsRecipient(e.target.value)}
                    placeholder="e.g. 0771234567 or 94771234567"
                    className="w-full h-[44px] pl-10 pr-4 bg-primary-soft hover:bg-white focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary-border rounded-ui-lg text-sm font-semibold text-fg outline-none transition-all placeholder:text-subtle shadow-2xs"
                  />
                </div>
              </div>

              {/* Message Body */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-muted">
                    SMS Message Content
                  </label>
                  <span className="font-mono text-[11px] text-subtle">
                    {smsMessage.length} chars ({Math.ceil(smsMessage.length / 160) || 1} SMS)
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Enter message..."
                  className="w-full bg-primary-soft hover:bg-white focus:bg-white border border-border focus:border-primary focus:ring-2 focus:ring-primary-border rounded-ui-lg p-3 text-xs sm:text-sm font-medium text-fg outline-none transition-all resize-none shadow-2xs"
                />
              </div>

              {/* Status Alert */}
              {smsStatus && (
                <div
                  className={`p-3 rounded-ui-lg text-xs font-bold flex items-center gap-2 ${
                    smsStatus.type === 'success'
                      ? 'bg-success-soft text-success border border-success-border'
                      : 'bg-danger-soft text-danger border border-danger-border'
                  }`}
                >
                  {smsStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                  )}
                  <span>{smsStatus.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setSmsModalOpen(false)}
                  disabled={smsLoading}
                  className="h-[44px] rounded-ui-lg font-bold text-xs sm:text-sm bg-surface-2 hover:bg-border text-muted border border-border transition-all active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={smsLoading || !smsRecipient.trim()}
                  className="h-[44px] rounded-ui-lg font-bold text-xs sm:text-sm bg-primary hover:bg-primary-hover disabled:opacity-50 text-white shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  {smsLoading ? (
                    <span>Sending SMS...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
