import React from 'react';
import { redirectCashierToPos } from '@/lib/server/roleRedirect';

/** The label workstation is for pharmacy staff; a cashier is sent to the point of sale. */
export default async function LabelLayout({ children }: { children: React.ReactNode }) {
  await redirectCashierToPos();
  return children;
}
