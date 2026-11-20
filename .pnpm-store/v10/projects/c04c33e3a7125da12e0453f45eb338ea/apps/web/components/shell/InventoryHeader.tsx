'use client';

import React from 'react';
import { PageHeader, TabNav, type Crumb } from '@/components/ui';
import { INVENTORY_TABS } from './nav';

/** Page header plus the inventory section tabs. */
export function InventoryHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} actions={actions} breadcrumbs={breadcrumbs ?? [{ label: 'Inventory', href: '/admin/inventory' }, { label: title }]} />
      <TabNav label="Inventory sections" tabs={INVENTORY_TABS} />
    </div>
  );
}
