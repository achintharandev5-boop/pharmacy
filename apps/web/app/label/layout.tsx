import React from 'react';
import { redirectCashierToPos } from '@/lib/server/roleRedirect';
import { getPharmacySettings } from '@/app/actions/settings';
import { labelPaperFrom } from '@/lib/labelPaper';
import { LabelPaperProvider } from '@/components/LabelPaper';

/** The label workstation is for pharmacy staff; a cashier is sent to the point of sale. */
export default async function LabelLayout({ children }: { children: React.ReactNode }) {
  await redirectCashierToPos();
  const settings = await getPharmacySettings();
  // rx-workstation keeps the workstation's clinical colour coding (theme.css) independent of the
  // brand palette. `contents` adds no box, so the workstation layout and the print path are unchanged.
  return (
    <LabelPaperProvider paper={labelPaperFrom(settings.ok ? settings.data : null)}>
      <div className="rx-workstation contents">{children}</div>
    </LabelPaperProvider>
  );
}
