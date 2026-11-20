'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'pharmacy-theme';
const CHANGE_EVENT = 'pharmacy-theme-change';
const valid = (value: string | null | undefined): value is ThemeMode => value === 'light' || value === 'dark' || value === 'system';

export function readTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'system';
  const current = document.documentElement.dataset.themePreference;
  if (valid(current)) return current;
  try { const saved = localStorage.getItem(THEME_STORAGE_KEY); return valid(saved) ? saved : 'system'; }
  catch { return 'system'; }
}

export function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));
  document.documentElement.dataset.themePreference = mode;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setTheme(mode: ThemeMode) {
  applyTheme(mode);
  try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* Still works for this session. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(notify: () => void) {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const changed = () => { applyTheme(readTheme()); notify(); };
  const stored = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(valid(event.newValue) ? event.newValue : 'system');
    notify();
  };
  media?.addEventListener('change', changed);
  window.addEventListener(CHANGE_EVENT, changed);
  window.addEventListener('storage', stored);
  return () => {
    media?.removeEventListener('change', changed);
    window.removeEventListener(CHANGE_EVENT, changed);
    window.removeEventListener('storage', stored);
  };
}

export function useTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => 'system' as ThemeMode);
}

/** Keeps system mode live even on screens without a selector. */
export function ThemeController() {
  useTheme();
  useEffect(() => { applyTheme(readTheme()); }, []);
  return null;
}

export function ThemeSwitcher({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
  const theme = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  if (iconOnly) return <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ui border border-border-strong bg-page text-muted" title={`Color theme: ${theme}`}>
    <Icon size={18} aria-hidden="true" className="pointer-events-none absolute" />
    <select aria-label="Color theme" value={theme} onChange={e => setTheme(e.target.value as ThemeMode)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-ui bg-transparent text-transparent [&>option]:text-fg [&>option]:bg-page">
      <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
    </select>
  </span>;
  return <label className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-muted">
    <span className={compact ? 'sr-only' : 'hidden sm:inline'}>Appearance</span>
    <select aria-label="Color theme" value={theme} onChange={e => setTheme(e.target.value as ThemeMode)}
      className="h-11 max-w-28 rounded-ui border border-border-strong bg-page px-2 text-sm text-fg">
      <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
    </select>
  </label>;
}

