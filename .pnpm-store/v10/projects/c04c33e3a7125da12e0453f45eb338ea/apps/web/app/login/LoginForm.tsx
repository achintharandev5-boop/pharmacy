'use client';

import React, { useActionState } from 'react';
import { handleLogin } from '../actions/auth';
import { Alert, Button, FormField, Input } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ui';

export default function LoginForm({ demo }: { demo: { email: string; password: string } | null }) {
  const [state, formAction, isPending] = useActionState(handleLogin, { error: '' });

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="absolute right-4 top-4"><ThemeSwitcher compact /></div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-ui-lg bg-primary font-serif text-xl font-bold italic text-[var(--color-on-solid)]" aria-hidden="true">
            ℞
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
          <p className="mt-1 text-sm text-subtle">Pharmacy labels &amp; inventory</p>
        </div>
        <div className="rounded-ui-lg border border-border bg-page p-6 shadow-card">
          {demo && (
            <div className="mb-4 rounded-ui border border-warning-border bg-warning-soft p-3 text-sm text-fg">
              <p className="font-semibold">Local UI testing</p>
              <p className="mt-1">Explore the actual interface. No pharmacy server or database is connected.</p>
              <p className="mt-2 font-mono text-xs">{demo.email} / {demo.password}</p>
            </div>
          )}
          <form action={formAction} className="space-y-4">
            {state?.error && <Alert>{state.error}</Alert>}
            <FormField label="Email">
              {(f) => <Input {...f} name="email" type="email" autoComplete="username" required autoFocus defaultValue={demo?.email} />}
            </FormField>
            <FormField label="Password">
              {(f) => <Input {...f} name="password" type="password" autoComplete="current-password" required defaultValue={demo?.password} />}
            </FormField>
            <Button type="submit" variant="primary" fullWidth loading={isPending}>
              {isPending ? 'Signing in…' : demo ? 'Sign in to UI testing' : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-subtle">
          {demo ? 'Local changes are temporary and cannot be saved to a database.' : 'Forgotten your password? Ask the pharmacy administrator to reset it.'}
        </p>
      </div>
    </main>
  );
}
