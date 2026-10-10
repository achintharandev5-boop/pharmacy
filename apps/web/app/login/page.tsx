'use client';

import React, { useActionState } from 'react';
import { handleLogin } from '../actions/auth';
import { Alert, Button, FormField, Input } from '@/components/ui';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(handleLogin, { error: '' });

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-ui-lg bg-primary font-serif text-xl font-bold italic text-white" aria-hidden="true">
            ℞
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">Sign in</h1>
          <p className="mt-1 text-sm text-subtle">Pharmacy labels &amp; inventory</p>
        </div>
        <div className="rounded-ui-lg border border-border bg-page p-6 shadow-card">
          <form action={formAction} className="space-y-4">
            {state?.error && <Alert>{state.error}</Alert>}
            <FormField label="Email">
              {(f) => <Input {...f} name="email" type="email" autoComplete="username" required autoFocus />}
            </FormField>
            <FormField label="Password">
              {(f) => <Input {...f} name="password" type="password" autoComplete="current-password" required />}
            </FormField>
            <Button type="submit" variant="primary" fullWidth loading={isPending}>
              {isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-subtle">Forgotten your password? Ask the pharmacy administrator to reset it.</p>
      </div>
    </main>
  );
}
