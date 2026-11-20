import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { redirectCashierToPos } from '@/lib/server/roleRedirect';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await redirectCashierToPos();
  return <AppShell>{children}</AppShell>;
}
