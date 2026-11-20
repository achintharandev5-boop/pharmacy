'use client';

import React, { useEffect } from 'react';
import { useLabelStore, type ActiveControl } from '../../store/labelStore';
import { DosagePanel } from './DosagePanel';
import { LabelActions } from './LabelActions';
import { EntPanel } from './EntPanel';
import { ExpDateModal } from './ExpDateModal';
import { DeleteLabelModal } from './DeleteLabelModal';
import { NumberPad } from '../NumberPad';
import { ActionQuantityPanel, COMPACT_QUANTITY_TARGETS } from './ActionQuantityPanel';
import { StatPanel } from '../StatPanel';
import { StatAdminPanel } from '../StatAdminPanel';
import { StatFollowUpPanel } from '../StatFollowUpPanel';
import { DaysOfWeekPanel } from '../../app/label/DaysOfWeekPanel';
import { DaysPanel } from './DaysPanel';

export type Workspace = 'ent' | 'days_of_week' | 'days' | 'number_pad' | 'stat' | 'stat_admin' | 'stat_followup' | 'expiry' | 'delete_label';

/**
 * The action whose panel is open on the right, or null for the default Dosage Schedule and
 * Administration view. Same priority as when these panels replaced the left action grid.
 */
export function activeWorkspace(state: {
  activeControl: ActiveControl;
  numberPad: { visible: boolean };
  expDateModalVisible: boolean;
  deleteLabelModalVisible: boolean;
}): Workspace | null {
  if (state.activeControl === 'ent') return 'ent';
  if (state.activeControl === 'days_of_week') return 'days_of_week';
  if (state.numberPad.visible) return 'number_pad';
  // Days (number of days), opened from the Days action button; its typed entry uses the number pad.
  if (state.activeControl === 'days') return 'days';
  if (state.activeControl === 'stat' || state.activeControl === 'stat_admin' || state.activeControl === 'stat_followup') return state.activeControl;
  if (state.expDateModalVisible) return 'expiry';
  if (state.deleteLabelModalVisible) return 'delete_label';
  return null;
}

export const useActiveWorkspace = () => useLabelStore(activeWorkspace);

/** The dosage row a number-pad entry belongs to, if it is a Morning/Lunch/Night quantity or X/Y. */
function dosageRow(target: ActiveControl | null): 'morning' | 'lunch' | 'night' | null {
  const time = target?.replace('_fraction', '');
  return time === 'morning' || time === 'lunch' || time === 'night' ? time : null;
}

/**
 * Right column of the label workstation. The action buttons stay on the left; the open action's
 * existing panel, with its Enter / Done / Cancel buttons, is shown here in place of the Dosage
 * Schedule. Administration stays below it (Weekly and Daily keep their own Done there). While a
 * dosage row's quantity is entered, that row stays visible above the pad with its live X/Y preview.
 */
export function ActionWorkspace() {
  const workspace = useActiveWorkspace();
  const editingRow = useLabelStore((state) => (state.numberPad.visible ? dosageRow(state.numberPad.targetControl) : null));
  // Action quantities (5H/6H/8H, Daily, Evening, Weekly, ENT custom) use the compact editor; the
  // number pad remains for typed entries (dosage rows, days, product quantity).
  const compactTarget = useLabelStore((state) => (state.numberPad.visible && COMPACT_QUANTITY_TARGETS.includes(state.numberPad.targetControl!) ? state.numberPad.targetControl : null));
  const labelIndex = useLabelStore((state) => state.activeLabelIndex);
  const reasonsOpen = useLabelStore((state) => state.activeControl === 'reasons');

  // Stacked layout (below 1024 px): an action's panel opens below the action grid, so bring it
  // into view. The desktop layout shows both columns and does not scroll.
  useEffect(() => {
    if (!workspace && !reasonsOpen) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 1023.98px)').matches) return;
    document.getElementById('workstation-right')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [workspace, reasonsOpen]);

  if (!workspace) {
    return (
      <>
        {/* Dosage Rows (Morning, Lunch, Night); also hosts the Reasons panel */}
        <DosagePanel />
        {/* Administration & Timing (Give, Take, Before, After) */}
        <LabelActions />
      </>
    );
  }

  const panel = {
    ent: <EntPanel />,
    days_of_week: <DaysOfWeekPanel />,
    days: <DaysPanel key={labelIndex} />,
    number_pad: compactTarget ? <ActionQuantityPanel key={`${labelIndex}-${compactTarget}`} /> : <NumberPad />,
    stat: <StatPanel />,
    stat_admin: <StatAdminPanel />,
    stat_followup: <StatFollowUpPanel />,
    expiry: <ExpDateModal />,
    delete_label: <DeleteLabelModal />,
  }[workspace];

  const section = (
    <section
      aria-label="Action workspace"
      data-workspace={workspace}
      className="bg-page border border-border rounded-ui-lg p-3 shadow-card lg:flex-1 lg:min-h-0 flex flex-col lg:overflow-y-auto"
    >
      {panel}
    </section>
  );

  if (editingRow) {
    return (
      <>
        <DosagePanel only={editingRow} />
        {section}
      </>
    );
  }
  return (
    <>
      {section}
      <LabelActions />
    </>
  );
}
