'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings } from 'lucide-react';
import { NAV_SECTIONS, isActive, navSectionsFor, type NavSection } from './nav';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { usePopoverKeyboard } from '@/lib/usePopoverKeyboard';
import { Drawer } from '@/components/ui/Drawer';
import { cn } from '@/components/ui/cn';
import { ToastProvider } from '@/components/ui/Toast';
import { handleLogout, getCurrentUser, type CurrentUser } from '@/app/actions/auth';
import { clearLocalReasons } from '@/lib/localReasons';
import { getAdminAlerts } from '@/app/actions/admin';
import { useApiQuery, type QueryState } from '@/lib/useApiQuery';
import { ROLE_LABEL, homeFor, isStaffRole } from '@/lib/roles';

/* ---------- Sidebar collapse preference (per browser; the layout works without it) ---------- */

const COLLAPSE_KEY = 'pharmacy-sidebar-collapsed';
const COLLAPSE_EVENT = 'pharmacy-sidebar-change';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** In-memory fallback so the toggle still works when storage is blocked. */
let memoryCollapsed: boolean | null = null;

function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(subscribeCollapsed, () => memoryCollapsed ?? readCollapsed(), () => false);
  const set = (value: boolean) => {
    memoryCollapsed = value;
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
    } catch {
      /* Session-only preference. */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };
  return [stored, set];
}

/* ---------- Brand ---------- */

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-ui bg-primary-solid font-serif text-lg font-bold italic text-[var(--color-on-primary-solid)]', className)}
      aria-hidden="true"
    >
      ℞
    </span>
  );
}

function Brand({ href = '/admin' }: { href?: string }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-3 rounded-ui px-1.5 py-1">
      <BrandMark />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-fg">Pharmacy System</span>
        <span className="block truncate text-xs leading-tight text-subtle">Labels &amp; inventory</span>
      </span>
    </Link>
  );
}

/* ---------- Navigation ---------- */

interface TooltipState {
  label: string;
  top: number;
}

function SidebarNav({ sections, onNavigate, collapsed = false }: { sections: NavSection[]; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const showTip = (label: string) => (event: React.SyntheticEvent<HTMLElement>) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2 });
  };
  const hideTip = () => setTip(null);

  return (
    <>
      <nav aria-label="Main" className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2.5' : 'px-3')} onScroll={hideTip}>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-border first:hidden" aria-hidden="true" />
              ) : (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{section.title}</p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item, pathname);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          hideTip();
                          onNavigate?.();
                        }}
                        onMouseEnter={showTip(item.label)}
                        onMouseLeave={hideTip}
                        onFocus={showTip(item.label)}
                        onBlur={hideTip}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex h-10 items-center gap-3 rounded-ui text-sm font-medium transition-colors',
                          collapsed ? 'justify-center' : 'px-3',
                          active
                            ? 'bg-[var(--color-nav-active)] text-primary-hover'
                            : 'text-muted hover:bg-[var(--color-tint)] hover:text-fg',
                        )}
                      >
                        {active && !collapsed && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
                        <Icon size={18} strokeWidth={active ? 2.25 : 2} aria-hidden="true" className={cn('shrink-0', active ? 'text-primary' : 'text-subtle group-hover:text-muted')} />
                        <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      {collapsed && tip && (
        <span
          role="presentation"
          aria-hidden="true"
          style={{ top: tip.top }}
          className="pointer-events-none fixed left-[84px] z-50 -translate-y-1/2 whitespace-nowrap rounded-ui-sm bg-[var(--color-tooltip)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-on-tooltip)] shadow-pop"
        >
          {tip.label}
        </span>
      )}
    </>
  );
}

/* ---------- Top bar controls ---------- */

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, close]);
}

/** Notifications come only from current stock records (GET /admin/dashboard/alerts). */
function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  usePopoverKeyboard(ref, open, close);
  useOutsideClose(ref, close);
  const alerts = useApiQuery(() => getAdminAlerts(), []);
  const actionable = alerts.status === 'success' ? alerts.data.filter((a) => a.type !== 'INFO') : [];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={actionable.length > 0 ? `Stock alerts: ${actionable.length}` : 'Stock alerts'}
        className="relative flex h-11 w-11 items-center justify-center rounded-ui text-muted transition-colors hover:bg-[var(--color-tint)] hover:text-fg"
      >
        <Bell size={19} aria-hidden="true" />
        {actionable.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-page bg-danger-accent px-1 text-[10px] font-bold leading-none text-white tabular" aria-hidden="true">
            {actionable.length > 9 ? '9+' : actionable.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-ui-lg border border-border bg-page shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-fg">Stock alerts</p>
            {alerts.status === 'error' && (
              <button type="button" onClick={alerts.retry} className="text-xs font-medium text-primary hover:underline">
                Retry
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {alerts.status === 'loading' && <p className="px-2.5 py-3 text-sm text-subtle">Loading…</p>}
            {alerts.status === 'error' && <p className="px-2.5 py-3 text-sm text-danger">Could not load alerts: {alerts.error}</p>}
            {alerts.status === 'success' && alerts.data.length === 0 && <p className="px-2.5 py-3 text-sm text-subtle">No stock alerts.</p>}
            {alerts.status === 'success' &&
              alerts.data.map((a) => (
                <Link
                  key={a.id}
                  href={a.href ?? '/admin/inventory'}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 rounded-ui px-2.5 py-2.5 hover:bg-[var(--color-tint)]"
                >
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.type === 'INFO' ? 'bg-chart-5' : a.type === 'CRITICAL' ? 'bg-danger-accent' : 'bg-warning-accent')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{a.title}</span>
                    <span className="block text-xs text-subtle">{a.message}</span>
                  </span>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Up to two initials from the account email's local part (no invented names). */
function initialsOf(email: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  const letters = (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)) || '';
  return letters.toUpperCase();
}

function UserMenu({ me }: { me: QueryState<CurrentUser> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  usePopoverKeyboard(ref, open, close);
  useOutsideClose(ref, close);

  const email = me.status === 'success' ? me.data.email : null;
  const role = me.status === 'success' ? me.data.role : null;
  const roleText = me.status === 'success' ? (role ? ROLE_LABEL[role] : 'No role assigned') : me.status === 'error' ? 'Unavailable' : '…';
  const initials = initialsOf(email);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={email ? `Account menu for ${email}` : 'Account menu'}
        className="flex h-11 items-center gap-2.5 rounded-ui pl-1 pr-1.5 text-left transition-colors hover:bg-[var(--color-tint)] md:pr-2.5"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-hover ring-1 ring-primary-border" aria-hidden="true">
          {initials || '·'}
        </span>
        <span className="hidden max-w-[180px] md:block">
          <span className="block truncate text-sm font-medium leading-tight text-fg">{email ?? 'Account'}</span>
          <span className="block text-xs leading-tight text-subtle">{roleText}</span>
        </span>
        <ChevronDown size={15} className="hidden text-subtle md:block" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-ui-lg border border-border bg-page p-1.5 shadow-pop">
          {email && (
            <div className="flex items-center gap-3 border-b border-border px-2.5 pb-3 pt-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-hover" aria-hidden="true">
                {initials || '·'}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{email}</span>
                <span className="mt-0.5 inline-flex rounded-full bg-[var(--color-tint)] px-2 py-0.5 text-[11px] font-medium text-primary-hover">{roleText}</span>
              </span>
            </div>
          )}
          <div className="pt-1.5">
            {isStaffRole(role) && (
              <Link role="menuitem" href="/admin/settings" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2.5 rounded-ui px-2.5 text-sm text-fg hover:bg-[var(--color-tint)]">
                <Settings size={16} className="text-subtle" aria-hidden="true" />
                Settings
              </Link>
            )}
            <form action={handleLogout} onSubmit={clearLocalReasons}>
              <button role="menuitem" type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-ui px-2.5 text-sm text-danger hover:bg-danger-soft">
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
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
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search patients, prescriptions, medicines"
        aria-label="Search patients by phone, prescriptions by RX number, or medicines by name"
        className="h-10 w-full rounded-ui border border-border bg-[var(--color-canvas)] pl-10 pr-16 text-sm text-fg placeholder:text-subtle transition-colors hover:border-primary-border focus:border-primary focus:bg-page focus:outline-none focus:ring-[3px] focus:ring-primary-soft"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-ui-sm border border-border bg-page px-1.5 py-0.5 font-sans text-[11px] font-medium text-subtle sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}

/* ---------- Shell ---------- */

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const pathname = usePathname();
  const me = useApiQuery<CurrentUser>(() => getCurrentUser(), []);
  const role = me.status === 'success' ? me.data.role : null;
  const staff = isStaffRole(role);
  const sections = navSectionsFor(role);
  const homeHref = staff ? '/admin' : homeFor(role) === '/pos' ? '/pos' : '/admin';
  const pageTitle = NAV_SECTIONS.flatMap((section) => section.items).find((item) => isActive(item, pathname))?.label
    ?? (pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Pharmacy');

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-ui focus:bg-page focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <div className="min-h-screen bg-[var(--color-canvas)]">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-[var(--color-sidebar)] transition-[width] duration-200 lg:flex',
            sidebarCollapsed ? 'w-[72px]' : 'w-64',
          )}
        >
          <div className={cn('flex h-16 shrink-0 items-center', sidebarCollapsed ? 'justify-center' : 'px-4')}>
            {sidebarCollapsed ? (
              <Link href={homeHref} aria-label="Pharmacy System home" title="Pharmacy System" className="rounded-ui">
                <BrandMark />
              </Link>
            ) : (
              <Brand href={homeHref} />
            )}
          </div>
          <SidebarNav sections={sections} collapsed={sidebarCollapsed} />
          <div className={cn('border-t border-border', sidebarCollapsed ? 'p-2.5' : 'p-3')}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Expand sidebar' : undefined}
              className={cn(
                'flex h-10 w-full items-center gap-2.5 rounded-ui text-sm font-medium text-muted transition-colors hover:bg-[var(--color-tint)] hover:text-fg',
                sidebarCollapsed ? 'justify-center' : 'px-3',
              )}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={18} aria-hidden="true" />
              ) : (
                <>
                  <PanelLeftClose size={18} aria-hidden="true" />
                  <span>Collapse menu</span>
                </>
              )}
            </button>
          </div>
        </aside>

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Navigation">
          <div className="flex h-16 shrink-0 items-center px-4">
            <Brand href={homeHref} />
          </div>
          <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
        </Drawer>

        <div className={cn('flex min-h-screen min-w-0 flex-col transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
          <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-page/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-page/85 sm:gap-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui text-muted hover:bg-[var(--color-tint)] lg:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <p className="hidden shrink-0 text-[15px] font-semibold tracking-tight text-fg md:block">{pageTitle}</p>
            <span className="hidden h-5 w-px shrink-0 bg-border md:block" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 justify-center sm:justify-start">{staff && <GlobalSearch />}</div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {staff && <Notifications />}
              <ThemeSwitcher iconOnly />
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
              <UserMenu me={me} />
            </div>
          </header>
          <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
