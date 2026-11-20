import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeController, ThemeSwitcher, THEME_STORAGE_KEY, setTheme } from './ThemeSwitcher';
import { themeBootstrap } from '@/lib/themeBootstrap';

let dark = false;
let listeners: Set<() => void>;
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  dark = false;
  listeners = new Set();
  vi.stubGlobal('matchMedia', () => ({ matches: dark, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('appearance preference', () => {
  it('applies and persists each explicit theme immediately', () => {
    render(<><ThemeController /><ThemeSwitcher /></>);
    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'dark' } });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'light' } });
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('follows OS changes only in system mode', () => {
    render(<ThemeController />);
    act(() => { dark = true; listeners.forEach(fn => fn()); });
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => { setTheme('light'); dark = false; listeners.forEach(fn => fn()); dark = true; listeners.forEach(fn => fn()); });
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('updates across tabs and treats cleared storage as system', () => {
    render(<ThemeSwitcher />);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' })));
    expect(screen.getByLabelText('Color theme')).toHaveValue('dark');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(screen.getByLabelText('Color theme')).toHaveValue('system');
  });
  it('still applies the theme if preference storage is denied', () => {
    render(<ThemeSwitcher />);
    const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'dark' } });
    expect(document.documentElement.dataset.theme).toBe('dark');
    denied.mockRestore();
  });
  it('initializes before hydration and rejects unknown stored preferences', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'unknown');
    dark = true;
    window.eval(themeBootstrap);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });
});
