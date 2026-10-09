'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="py-12 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

/** Shown when a request fails. Never pair this with placeholder data. */
export function ErrorState({ title = 'Could not load data', message, onRetry, retrying, compact }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center gap-2.5 ${compact ? 'p-4' : 'p-8 sm:p-12'}`}
    >
      <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-600 max-w-md font-medium">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Inline banner for a failed save or action. */
export function ActionError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-rose-700 hover:underline font-bold">
          Dismiss
        </button>
      )}
    </div>
  );
}

/** Placeholder for a value the API did not provide. Never substitute an invented value. */
export const MISSING = '—';
