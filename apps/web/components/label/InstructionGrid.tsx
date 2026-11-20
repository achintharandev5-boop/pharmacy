'use client';

import { reasonSelectionRefusal } from '../../lib/reasons';
import { formatDays, daySelectionRefusal, formatWeekdayRange } from '../../lib/nameOfDays';
import { weeklySelectionRefusal } from '../../lib/weeklyPolicy';
import { dailySelectionRefusal } from '../../lib/dailyPolicy';
import { eveningSelectionRefusal } from '../../lib/eveningPolicy';
import { digitalSelectionRefusal } from '../../lib/digitalSchedule';
import { intervalSelectionRefusal } from '../../lib/intervalPolicy';
import { statSelectionRefusal } from '../../lib/statPolicy';
import { eodSelectionRefusal } from '../../lib/eod';

import React from 'react';
import { GridTile, ActionTile, type Tile, ControlHints, LockNoticeLine, useLockNotice, hintId, STAT_LOCK_HINT, PANEL_LOCK_HINT, LOCK_FALLBACK } from './InstructionTile';

import { useLabelStore, isStatStep } from '../../store/labelStore';
import { EXPIRY_CODE } from '../../lib/batchExpiry';
import { useActiveWorkspace } from './ActionWorkspace';
import { analyseAdministration, chewingSelectionRefusal, dissolveSelectionRefusal, withFoodSelectionRefusal, keepInMouthSelectionRefusal, DIGI_LABEL_LOCKS, formInstructions, getWordingMode, QUANTITY_CODES } from '../../lib/instructionEngine';
import { formatDosageReadable } from '../../lib/labelBuilder';
import { SelectedInstructionsPanel } from './SelectedInstructionsPanel';
import {
  MessageSquareText,
  MapPinOff,
  Calendar,
  CirclePlus,
  Trash2,
  Utensils,
  Pill,
  GlassWater,
  Clock,
  CalendarCheck,
  Sunset,
  RefreshCcw,
  ChevronsRight,
  Zap,
  CircleDot,
  Smile,
  type LucideIcon,
} from 'lucide-react';

interface InstructionGridProps {
  validationError?: string | null;
}

export function InstructionGrid({ validationError }: InstructionGridProps) {
  const activeControl = useLabelStore((state) => state.activeControl);
  // An action panel open on the right (ActionWorkspace). The grid stays visible, but its tiles are
  // locked until that panel is confirmed or cancelled, as when the panel used to replace the grid.
  const workspace = useActiveWorkspace();
  const weekdayRange = useLabelStore(state => state.labels[state.activeLabelIndex]?.weekdayRange);
  const selectedDaysOfWeek = useLabelStore((state) => state.selectedDaysOfWeek);
  const days = useLabelStore((state) => state.days);
  const additionalInstructions = useLabelStore((state) => state.additionalInstructions);
  const reasons = useLabelStore((state) => state.reasons);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const stat = useLabelStore((state) => state.stat);
  const dosage = useLabelStore((state) => state.dosage);
  const weeklyDosage = useLabelStore(state => state.weeklyDosage);
  const frequencyDosage = useLabelStore((state) => state.frequencyDosage);
  const showAddress = useLabelStore((state) => state.showAddress);
  const toggleShowAddress = useLabelStore((state) => state.toggleShowAddress);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);
  const openDaysOfWeekPanel = useLabelStore((state) => state.openDaysOfWeekPanel);
  const openReasonsPanel = useLabelStore((state) => state.openReasonsPanel);
  const startStat = useLabelStore((state) => state.startStat);
  const openDeleteLabelModal = useLabelStore((state) => state.openDeleteLabelModal);
  const addLabel = useLabelStore((state) => state.addLabel);

  const isStatFlow = isStatStep(activeControl);
  const isReasonsOpen = activeControl === 'reasons';
  const incompleteInterval = !workspace && !isStatFlow && !(frequencyDosage.qty > 0)
    ? ['5H', '6H', '8H'].find((code) => additionalInstructions.includes(code))
    : undefined;

  const has = (key: string) => additionalInstructions.includes(key);
  const toggle = (key: string, label: string, icon: LucideIcon): Tile => ({
    key,
    label,
    icon,
    selected: has(key),
    toggle: true,
    onClick: () => toggleAdditionalInstruction(key),
    detail: key === 'WEEKLY' && has(key) && (weeklyDosage?.qty ?? 0) > 0 ? formatDosageReadable(weeklyDosage!.qty, weeklyDosage!.isFraction) : QUANTITY_CODES.includes(key) && has(key) && frequencyDosage.qty > 0
      ? `${formatDosageReadable(frequencyDosage.qty, frequencyDosage.isFraction)} each`
      : null,
  });

  const reasonCount = reasons?.length ?? 0;

  const reasonsTile: Tile = {
    key: 'REASONS',
    label: 'Reasons',
    icon: MessageSquareText,
    selected: reasonCount > 0 || isReasonsOpen,
    expanded: isReasonsOpen,
    toggle: false,
    onClick: () => (isReasonsOpen ? useLabelStore.getState().cancelReasonsPanel() : openReasonsPanel()),
    detail: reasonCount > 0 ? `${reasonCount} selected` : null,
  };

  const addressTile: Tile = {
    key: 'REMOVE ADDRESS',
    label: showAddress ? 'Remove Address' : 'Address Hidden',
    icon: MapPinOff,
    selected: !showAddress,
    toggle: true,
    onClick: toggleShowAddress,
  };

  const statTile: Tile = {
    key: 'STAT',
    label: 'STAT',
    icon: Zap,
    iconClass: 'fill-current',
    labelClass: 'text-coral-strong',
    selected: Boolean(stat) || has('STAT'),
    expanded: isStatFlow,
    toggle: false,
    onClick: startStat,
  };

  const expTile: Tile = {
    key: 'ADD EXP DATE',
    label: 'EXP Date',
    icon: Calendar,
    // Not selected by default; tap to retrieve the GRN batch expiry, tap again to remove it.
    selected: additionalInstructions.includes(EXPIRY_CODE),
    toggle: true,
    disabled: isStatFlow,
    onClick: () => toggleAdditionalInstruction(EXPIRY_CODE),
    detail: expiryDate,
  };

  // ENT (eye, ear, nose) opens from the Administration card (LabelActions), not from this grid.

  const activeLabel = useLabelStore((state) => state.labels[state.activeLabelIndex]);
  const daysLabel = weekdayRange ? (formatWeekdayRange(weekdayRange) || 'Select end day') :
    selectedDaysOfWeek.length > 0
      ? formatDays(selectedDaysOfWeek)
      : 'Name of Days';

  // Days and Name of Days moved here from the controls below the grid, with the same enabled rules.
  // Till to the Day and Edit start day are now inside the Select Days panel (DaysOfWeekPanel).
  const daysTile: Tile = {
    key: 'DAYS', label: 'Days', icon: Calendar, expanded: activeControl === 'days',
    selected: days != null && days > 0, toggle: false, disabled: isStatFlow,
    detail: days != null && days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : undefined,
    onClick: () => useLabelStore.getState().setActiveControl('days'),
  };
  const nameOfDaysRefusal = daySelectionRefusal(activeLabel, 'NAME OF DAYS') ?? intervalSelectionRefusal(activeLabel, 'NAME OF DAYS') ?? eodSelectionRefusal(activeLabel, 'NAME OF DAYS');
  const nameOfDaysTile: Tile = {
    key: 'NAME OF DAYS', label: 'Name of Days', icon: Calendar, expanded: activeControl === 'days_of_week',
    selected: selectedDaysOfWeek.length > 0 || Boolean(weekdayRange), toggle: false,
    disabled: isStatFlow || Boolean(nameOfDaysRefusal),
    state: !isStatFlow && nameOfDaysRefusal ? 'locked' : undefined,
    stateHint: isStatFlow ? STAT_LOCK_HINT : nameOfDaysRefusal ?? undefined,
    detail: daysLabel !== 'Name of Days' ? daysLabel : undefined,
    onClick: () => openDaysOfWeekPanel(),
  };

  // Every feature tile; GRID_ORDER below places them (with the two label actions) in one grid.
  // Idle icon and selected colours follow each key's tone (instructionCategory).
  const schedule: Tile[] = [
    daysTile,
    nameOfDaysTile,
    toggle('DAILY', 'Daily', CalendarCheck),
    toggle('WEEKLY', 'Weekly', RefreshCcw),
    toggle('EVENING', 'Evening', Sunset),
    toggle('EOD', 'EOD', ChevronsRight),
    toggle('5H', '5H', Clock),
    toggle('6H', '6H', Clock),
    toggle('8H', '8H', Clock),
  ];
  const instructions: Tile[] = [
    reasonsTile,
    toggle('WITH FOOD', 'With Food', Utensils),
    toggle('EMPTY STOMACH', 'Empty Stomach', CircleDot),
    toggle('CHEWABLE', 'Chewable', Pill),
    toggle('DISSOLVE AND DRINK', 'Dissolve and Drink', GlassWater),
    toggle('KEEP IN MOUTH', 'Keep in Mouth', Smile),
    addressTile,
    expTile,
    statTile,
  ];

  // Workflow states from the instruction engine (same analysis as DONE and the Administration card).
  const analysis = analyseAdministration(additionalInstructions, dosage, undefined, frequencyDosage.qty);
  const specMode = getWordingMode() === 'spec';
  const hasDose = dosage.morning.qty > 0 || dosage.lunch.qty > 0 || dosage.night.qty > 0;
  const forms = formInstructions();
  const decorate = (tile: Tile): Tile => {
    if (workspace) return { ...tile, disabled: true, stateHint: PANEL_LOCK_HINT };
    // Their own enabled rules, unchanged from the former controls below the grid.
    if (tile.key === 'DAYS' || tile.key === 'NAME OF DAYS') return tile;
    const chewingLock = reasonSelectionRefusal(activeLabel, tile.key) ?? daySelectionRefusal(activeLabel, tile.key) ?? weeklySelectionRefusal(activeLabel, tile.key) ?? dailySelectionRefusal(activeLabel, tile.key) ?? eveningSelectionRefusal(activeLabel, tile.key) ?? digitalSelectionRefusal(activeLabel, tile.key) ?? intervalSelectionRefusal(activeLabel, tile.key) ?? statSelectionRefusal(activeLabel, tile.key) ?? eodSelectionRefusal(activeLabel, tile.key) ?? chewingSelectionRefusal(additionalInstructions, tile.key) ?? dissolveSelectionRefusal(additionalInstructions, tile.key) ?? withFoodSelectionRefusal(additionalInstructions, tile.key) ?? keepInMouthSelectionRefusal(additionalInstructions, tile.key);
    if (chewingLock) return { ...tile, disabled: true, state: 'locked', stateHint: chewingLock };
    if (tile.selected && analysis.status === 'invalid' && (forms.includes(tile.key) || DIGI_LABEL_LOCKS.includes(tile.key))) {
      return { ...tile, state: 'invalid', stateHint: analysis.problems[0] };
    }
    if (tile.selected && analysis.status === 'incomplete' && forms.includes(tile.key)) {
      return { ...tile, state: 'requires-input', stateHint: `Next: ${analysis.nextStep}` };
    }
    if (specMode && hasDose && !tile.selected && DIGI_LABEL_LOCKS.includes(tile.key)) {
      return { ...tile, state: 'locked', stateHint: 'Locked while Morning, Lunch or Night has a dose' };
    }
    return tile;
  };
  // Every locked tile explains itself: its rule's refusal, or why it is locked right now.
  const explain = (tile: Tile): Tile => {
    const decorated = decorate(tile);
    return decorated.disabled && !decorated.stateHint ? { ...decorated, stateHint: isStatFlow ? STAT_LOCK_HINT : LOCK_FALLBACK } : decorated;
  };
  const labelActionHint = workspace ? PANEL_LOCK_HINT : undefined;
  const [lockNotice, setLockNotice] = useLockNotice();
  const tiles = new Map([...schedule, ...instructions].map((tile) => [tile.key, explain(tile)]));

  // Label actions inside the grid: Add is the positive (green) action; Delete is outlined coral and still
  // asks for confirmation (DeleteLabelModal) before anything is removed.
  const labelActions: Record<string, React.ReactNode> = {
    'ADD LABEL': (
      <ActionTile
        label="Add Label"
        icon={CirclePlus}
        sizeClass="w-full h-full"
        colorClass="border-green-solid bg-green-solid hover:bg-green-solid-hover active:bg-green-solid-active"
        onClick={addLabel}
        disabled={Boolean(workspace)}
        lockedHint={labelActionHint}
        describedBy={hintId('grid', 'ADD LABEL')}
        onLocked={setLockNotice}
      />
    ),
    'DELETE LABEL': (
      <ActionTile
        label="Delete Label"
        icon={Trash2}
        variant="outline"
        sizeClass="w-full h-full"
        colorClass="bg-page border-coral text-coral-strong hover:bg-coral-soft active:bg-coral-soft"
        onClick={openDeleteLabelModal}
        disabled={Boolean(workspace)}
        lockedHint={labelActionHint}
        describedBy={hintId('grid', 'DELETE LABEL')}
        onLocked={setLockNotice}
      />
    ),
  };

  return (
    <div className="w-full lg:h-full flex flex-col gap-2 min-w-0 lg:min-h-0">
      {/* 1. SELECTED INSTRUCTIONS CARD: as tall as its warnings need; the grid takes the rest. */}
      <SelectedInstructionsPanel validationError={validationError} />
      {incompleteInterval && (
        <button
          type="button"
          className="min-h-11 px-3 py-2 rounded-ui-lg bg-primary-solid text-on-primary-solid font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => useLabelStore.getState().openNumberPad('frequency')}
        >
          Enter the quantity for {incompleteInterval}
        </button>
      )}

      {/* 2. FEATURE PANEL: one grid, five columns from 640 px (four, then three on narrow phones).
          On desktop its four rows share the remaining height, so all 20 tiles are always in view
          (no scrolling); tiles compact their icon when short. An action's panel opens on the right. */}
      <div className="bg-page border border-border rounded-ui-lg p-2 shadow-card lg:flex-1 lg:min-h-0 flex flex-col gap-2">
          {/* A tap on a locked tile explains why here (touch and keyboard as well as mouse). */}
          <LockNoticeLine notice={lockNotice} onDismiss={() => setLockNotice(null)} />
          <div
            data-testid="action-grid"
            className="grid grid-cols-3 min-[480px]:grid-cols-4 sm:grid-cols-5 auto-rows-[minmax(5.5rem,1fr)] lg:grid-rows-[repeat(4,minmax(3rem,1fr))] gap-2 lg:flex-1 lg:min-h-0 w-full"
          >
            {GRID_ORDER.map((key) => {
              const tile = tiles.get(key);
              return tile
                ? <GridTile key={key} tile={tile} selectedStyle="solid" describedBy={hintId('grid', key)} onLocked={setLockNotice} />
                : <React.Fragment key={key}>{labelActions[key]}</React.Fragment>;
            })}
          </div>
          <ControlHints
            hints={[
              ...[...tiles.values()].map((tile) => ({ id: hintId('grid', tile.key), text: tile.stateHint })),
              ...['ADD LABEL', 'DELETE LABEL'].map((key) => ({ id: hintId('grid', key), text: labelActionHint })),
            ]}
          />
      </div>
    </div>
  );
}

/** The feature grid, row by row (five per row on wide screens). */
const GRID_ORDER = [
  'REASONS', 'DAYS', '5H', 'EVENING', '6H',
  'REMOVE ADDRESS', 'NAME OF DAYS', 'WEEKLY', 'STAT', 'EOD',
  'ADD EXP DATE', 'EMPTY STOMACH', 'WITH FOOD', 'CHEWABLE', 'DAILY',
  'DELETE LABEL', 'ADD LABEL', 'DISSOLVE AND DRINK', 'KEEP IN MOUTH', '8H',
];
