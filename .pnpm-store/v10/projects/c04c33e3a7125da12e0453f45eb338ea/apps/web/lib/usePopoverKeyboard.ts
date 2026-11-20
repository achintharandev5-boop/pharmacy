'use client';
import { useEffect, useRef, type RefObject } from 'react';

export function usePopoverKeyboard(ref: RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    const items = () => [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    items()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); close.current(); panel?.querySelector<HTMLButtonElement>('button')?.focus();
      }
      const list = items();
      if (!list.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    };
    const focus = (event: FocusEvent) => { if (event.target instanceof Node && !panel?.contains(event.target)) close.current(); };
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', focus);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); };
  }, [open, ref]);
}
