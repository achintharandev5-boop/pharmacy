'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

/** Native modal provides focus containment, background inertness and Escape handling. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', ''); // Non-browser test environments.
    return () => {
      dialog?.close?.();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(<dialog ref={ref} aria-label={title} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 border-r border-border bg-page p-0 text-fg shadow-pop backdrop:bg-[var(--color-backdrop)]">
    <div className="flex h-full flex-col">
      <div className="absolute right-2 top-2"><IconButton icon={X} label="Close navigation" onClick={onClose} /></div>
      {children}
    </div>
  </dialog>, document.body);
}
