'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, Search, Settings, User, X } from 'lucide-react';
import { NAV_SECTIONS, isActive } from './nav';
import { cn } from '@/components/ui/cn';
import { ToastProvider } from '@/components/ui/Toast';
import { handleLogout, getCurrentUser, type CurrentUser } from '@/app/actions/auth';
import { getAdminAlerts } from '@/app/actions/admin';
import { useApiQuery } from '@/lib/useApiQuery';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', pharmacist: 'Pharmacist', staff: 'Staff' };

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-ui bg-primary text-white font-serif italic font-bold" aria-hidden="true">
        ℞
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg leading-tight">Pharmacy System</span>
        <span className="block text-xs text-subtle leading-tight">Labels &amp; inventory</span>
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1.5 text-xs font-medium text-subtle">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-ui px-2.5 text-sm font-medium transition-colors',
                      active ? 'bg-primary-soft text-primary-hover' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <Icon size={18} aria-hidden="true" className={active ? 'text-primary' : 'text-subtle'} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Notifications come only from current stock records (GET /admin/dashboard/alerts). */
function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const alerts = useApiQuery(() => getAdminAlerts(), []);
  const actionable = alerts.status === 'success' ? alerts.data.filter((a) => a.type !== 'INFO') : [];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={actionable.length > 0 ? `Stock alerts: ${actionable.length}` : 'Stock alerts'}
        className="relative flex h-10 w-10 items-center justify-center rounded-ui text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Bell size={18} aria-hidden="true" />
        {actionable.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-ui-lg border border-border bg-page shadow-pop z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-fg">Stock alerts</p>
            {alerts.status === 'error' && (
              <button type="button" onClick={alerts.retry} className="text-xs font-medium text-primary hover:underline">
                Retry
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {alerts.status === 'loading' && <p className="px-2 py-3 text-sm text-subtle">Loading…</p>}
            {alerts.status === 'error' && <p className="px-2 py-3 text-sm text-danger">Could not load alerts: {alerts.error}</p>}
            {alerts.status === 'success' && alerts.data.length === 0 && <p className="px-2 py-3 text-sm text-subtle">No stock alerts.</p>}
            {alerts.status === 'success' &&
              alerts.data.map((a) => (
                <Link
                  key={a.id}
                  href={a.href ?? '/admin/inventory'}
                  onClick={() => setOpen(false)}
                  className="block rounded-ui px-2 py-2 hover:bg-surface"
                >
                  <p className="text-sm font-medium text-fg">{a.title}</p>
                  <p className="text-xs text-subtle">{a.message}</p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const me = useApiQuery<CurrentUser>(() => getCurrentUser(), []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const email = me.status === 'success' ? me.data.email : null;
  const role = me.status === 'success' ? me.data.role : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-ui px-2 text-left hover:bg-surface-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden="true">
          <User size={16} />
        </span>
        <span className="hidden md:block max-w-[180px]">
          <span className="block truncate text-sm font-medium text-fg">{email ?? 'Account'}</span>
          <span className="block text-xs text-subtle">
            {me.status === 'success' ? (role ? ROLE_LABEL[role] : 'No role assigned') : me.status === 'error' ? 'Unavailable' : '…'}
          </span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-ui-lg border border-border bg-page p-1.5 shadow-pop z-50">
          {email && <p className="truncate px-2.5 py-2 text-xs text-subtle">Signed in as {email}</p>}
          <Link role="menuitem" href="/admin/settings" onClick={() => setOpen(false)} className="flex h-9 items-center gap-2 rounded-ui px-2.5 text-sm text-fg hover:bg-surface-2">
            <Settings size={16} className="text-subtle" aria-hidden="true" />
            Settings
          </Link>
          <form action={handleLogout}>
            <button role="menuitem" type="submit" className="flex h-9 w-full items-center gap-2 rounded-ui px-2.5 text-sm text-danger hover:bg-danger-soft">
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Routes the header search to the list page that matches the term. Those pages read ?search=. */
function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const lower = term.toLowerCase();
    const target = /^(\+?94|0)?\d{7,}$/.test(lower.replace(/[\s-]/g, ''))
      ? '/admin/patients'
      : lower.startsWith('rx')
        ? '/admin/prescriptions'
        : '/admin/products';
    router.push(`${target}?search=${encodeURIComponent(term)}`);
  };

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search patients, prescriptions, medicines"
        aria-label="Search patients by phone, prescriptions by RX number, or medicines by name"
        className="h-10 w-full rounded-ui border border-border bg-surface pl-9 pr-14 text-sm text-fg placeholder:text-subtle focus:border-primary focus:bg-page focus:outline-none focus:ring-2 focus:ring-primary-soft"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-page px-1.5 text-[11px] text-subtle sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-ui focus:bg-page focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <div className="min-h-screen bg-surface">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-page lg:flex">
          <div className="flex h-16 items-center border-b border-border px-3">
            <Brand />
          </div>
          <SidebarNav />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-fg/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <div className="relative flex w-72 max-w-[85vw] flex-col bg-page shadow-pop">
              <div className="flex h-16 items-center justify-between border-b border-border px-3">
                <Brand />
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="flex h-10 w-10 items-center justify-center rounded-ui text-muted hover:bg-surface-2">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-h-screen flex-col lg:pl-60">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-page px-4 sm:px-6">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" className="flex h-10 w-10 items-center justify-center rounded-ui text-muted hover:bg-surface-2 lg:hidden">
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="flex flex-1 justify-center sm:justify-start">
              <GlobalSearch />
            </div>
            <Notifications />
            <UserMenu />
          </header>
          <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
