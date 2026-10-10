import React from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, FilePlus2, LayoutDashboard, LogOut, type LucideIcon } from 'lucide-react';
import { handleLogout } from './actions/auth';

const DESTINATIONS: { href: string; title: string; description: string; icon: LucideIcon; primary?: boolean }[] = [
  {
    href: '/label',
    title: 'Label workstation',
    description: 'Select the patient and medicine, set the Sinhala dosage instructions, then print and save the labels.',
    icon: FilePlus2,
    primary: true,
  },
  {
    href: '/admin',
    title: 'Dashboard',
    description: 'Today’s prescriptions, patients, label history and analytics.',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/inventory',
    title: 'Inventory',
    description: 'Stock levels, batches and expiry, receiving deliveries and adjustments.',
    icon: Boxes,
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex h-16 items-center justify-between border-b border-border bg-page px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-ui bg-primary font-serif font-bold italic text-white" aria-hidden="true">
            ℞
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight text-fg">Pharmacy System</span>
            <span className="block text-xs leading-tight text-subtle">Labels &amp; inventory</span>
          </span>
        </div>
        <form action={handleLogout}>
          <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-ui px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Where would you like to start?</h1>
        <p className="mt-1 text-sm text-subtle">Choose a workspace.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {DESTINATIONS.map(({ href, title, description, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col rounded-ui-lg border bg-page p-6 shadow-card transition-colors hover:border-primary-border ${
                primary ? 'border-primary-border' : 'border-border'
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-ui ${primary ? 'bg-primary text-white' : 'bg-primary-soft text-primary'}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="mt-4 text-base font-semibold text-fg">{title}</span>
              <span className="mt-1 flex-1 text-sm text-subtle">{description}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
