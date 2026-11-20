'use client';

import React, { useState } from 'react';
import { Eye, Ear, Wind, Clock3, CalendarCheck, Sunset, CirclePlus, Trash2, ArrowLeft, ArrowRight, MoveHorizontal, CalendarDays } from 'lucide-react';
import { GridTile, ActionTile, SELECTED, type Tile, ControlHints, LockNoticeLine, useLockNotice, hintId } from './InstructionTile';

const SITE_FIRST = 'Select Eye, Nose or Ear first.';
import { useLabelStore } from '../../store/labelStore';
import { defaultEnt, readEnt, validateEnt, type EntSite, type EntSelection } from '../../lib/ent';

const control = 'min-h-12 min-w-0 rounded-ui-lg border px-2.5 text-sm font-bold touch-manipulation transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.97]';
const selected = SELECTED.blue;
const unselected = 'bg-page border-border text-fg hover:bg-surface hover:border-primary-border';
const sites = [ ['eye', 'Eye', Eye], ['ear', 'Ear', Ear], ['nose', 'Nose', Wind] ] as const;

export function EntPanel() {
  const instructions = useLabelStore(s => s.additionalInstructions);
  const setEnt = useLabelStore(s => s.setEnt);
  const setActiveControl = useLabelStore(s => s.setActiveControl);
  const toggleInstruction = useLabelStore(s => s.toggleAdditionalInstruction);
  const addLabel = useLabelStore(s => s.addLabel);
  const deleteLabel = useLabelStore(s => s.openDeleteLabelModal);
  const workflowNotice = useLabelStore(s => s.workflowNotice);
  const productUnit = useLabelStore(s => s.product?.unit_of_measure);
  const ent = readEnt(instructions);
  const [editor, setEditor] = useState<'startDay' | 'endDay' | 'hours' | null>(null);
  const [hours, setHours] = useState('');
  const [hoursError, setHoursError] = useState<string | null>(null);
  const openNumberPad = useLabelStore(s => s.openNumberPad);
  const [lockNotice, setLockNotice] = useLockNotice();
  const activeFrequency = instructions.find(i => ['4H', '5H', '6H', '8H', 'CUSTOM', 'DAILY', 'EVENING'].includes(i));
  const update = (patch: Partial<EntSelection>) => { if (ent) setEnt({ ...ent, ...patch }); };
  const chooseSite = (site: EntSite) => {
    if (site === ent?.site) return;
    const next = defaultEnt(site);
    // Packaging units (bottle, pack) are not administration units.
    const units: Record<string, [string, string]> = { drop: ['drop', 'drops'], drops: ['drop', 'drops'], spray: ['spray', 'sprays'], sprays: ['spray', 'sprays'], puff: ['puff', 'puffs'], puffs: ['puff', 'puffs'], ml: ['mL', 'mL'] };
    const configured = units[productUnit?.toLowerCase() || ''];
    if (configured) [next.unit, next.pluralUnit] = configured;
    setEnt({ ...next, customHours: ent?.customHours, startDay: ent?.startDay, endDay: ent?.endDay });
  };
  const directionSupported = ent?.site === 'eye' || ent?.site === 'ear';
  const directionTile = (direction: 'left' | 'both' | 'right'): Tile => ({
    key: direction, label: direction.toUpperCase(),
    icon: direction === 'left' ? ArrowLeft : direction === 'right' ? ArrowRight : MoveHorizontal,
    selected: Boolean(directionSupported && ent?.direction === direction), toggle: true,
    disabled: !directionSupported, onClick: () => update({ direction }),
    stateHint: directionSupported ? undefined : ent ? 'Left, Right and Both apply to Eye or Ear only.' : SITE_FIRST,
  });
  const siteTile = (site: typeof sites[number]): Tile => ({
    key: site[0], label: site[1], icon: site[2],
    selected: ent?.site === site[0], toggle: true,
    onClick: () => chooseSite(site[0]),
  });
  const frequencyTile = (code: string, label = code): Tile => ({
    key: code, label, icon: code === 'DAILY' ? CalendarCheck : code === 'EVENING' ? Sunset : Clock3,
    selected: instructions.includes(code), toggle: true, disabled: !ent, stateHint: ent ? undefined : SITE_FIRST,
    onClick: () => toggleInstruction(code),
  });
  const editorTile = (field: 'startDay' | 'endDay' | 'hours', label: string): Tile => ({
    key: field, label, icon: field === 'hours' ? Clock3 : CalendarDays,
    selected: field === 'hours' ? activeFrequency === 'CUSTOM' : Boolean(ent?.[field]),
    toggle: false, disabled: !ent, stateHint: ent ? undefined : SITE_FIRST, expanded: editor === field,
    controls: 'ent-schedule-editor',
    onClick: () => { setEditor(editor === field ? null : field); setHours(String(ent?.customHours ?? '')); setHoursError(null); },
  });
  const tiles: (Tile | 'add' | 'delete')[] = [
    directionTile('left'), directionTile('both'), directionTile('right'), frequencyTile('5H'), frequencyTile('6H'),
    siteTile(sites[0]), siteTile(sites[2]), siteTile(sites[1]), frequencyTile('4H'), frequencyTile('DAILY', 'Daily'),
    'add', 'delete', editorTile('startDay', 'Start Day'), editorTile('endDay', 'End Day'), frequencyTile('8H'),
    editorTile('hours', 'Customize Hours'), frequencyTile('EVENING', 'Evening'),
  ];
  return (
    <section aria-label="ENT administration" className="@container flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain bg-page pr-0.5">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
        <h2 className="text-base font-bold text-fg">ENT Administration</h2>
        <button type="button" className={`${control} ${selected} flex items-center justify-center gap-1.5 px-4`} onClick={() => setActiveControl('idle')}>Done</button>
      </div>

      <div className="grid flex-1 grid-cols-3 auto-rows-[minmax(56px,1fr)] gap-2 @min-[420px]:grid-cols-5" aria-label="ENT administration controls">
        {tiles.map(item => item === 'add' ? (
          <ActionTile showIcons={false} key={item} label="Add Label" icon={CirclePlus} colorClass="border-green-solid bg-green-solid hover:bg-green-solid-hover active:bg-green-solid-active" onClick={addLabel} />
        ) : item === 'delete' ? (
          <ActionTile showIcons={false} key={item} label="Delete Label" icon={Trash2} variant="outline" colorClass="bg-page border-coral text-coral-strong hover:bg-coral-soft active:bg-coral-soft" onClick={deleteLabel} />
        ) : <GridTile showIcons={false} key={item.key} tile={item} describedBy={hintId('ent', item.key)} onLocked={setLockNotice} />)}
      </div>
      <ControlHints hints={tiles.flatMap(item => typeof item === 'string' ? [] : [{ id: hintId('ent', item.key), text: item.stateHint }])} />
      <LockNoticeLine notice={lockNotice} onDismiss={() => setLockNotice(null)} />
      {editor && ent && <div id="ent-schedule-editor" className="shrink-0 rounded-ui-lg border border-primary-border bg-primary-soft p-2">
        {editor === 'hours' ? <>
          <label className="text-xs font-semibold text-muted">Custom interval (hours)<input type="number" inputMode="numeric" min={1} max={24} step={1} value={hours} onChange={e => setHours(e.target.value)} className={`${control} mt-1 w-full bg-page`} /></label>
          {hoursError && <p role="alert" className="mt-1 text-xs text-danger">{hoursError}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" className={`${control} ${selected} flex-1`} onClick={() => {
              const value = Number(hours);
              if (!/^\d+$/.test(hours) || !Number.isInteger(value) || value < 1 || value > 24) { setHoursError('Enter a whole number from 1 to 24.'); return; }
              update({ customHours: value });
              setEditor(null);
              if (instructions.includes('CUSTOM')) openNumberPad('frequency'); else toggleInstruction('CUSTOM');
            }}>Apply Hours</button>
            <button type="button" className={`${control} ${unselected}`} onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </> : <>
          <label className="text-xs font-semibold text-muted">{editor === 'startDay' ? 'Start Day' : 'End Day'}<input type="date" value={ent[editor] || ''} min={editor === 'endDay' ? ent.startDay : undefined} max={editor === 'startDay' ? ent.endDay : '9999-12-31'} className={`${control} mt-1 w-full bg-page`} onChange={e => update({ [editor]: e.target.value || undefined })} /></label>
          <div className="mt-2 flex gap-2"><button type="button" className={`${control} ${unselected} flex-1`} onClick={() => update({ [editor]: undefined })}>Clear Date</button><button type="button" className={`${control} ${selected} flex-1`} onClick={() => setEditor(null)}>Close</button></div>
        </>}
      </div>}

      {workflowNotice && <p role="status" className="text-xs text-danger">{workflowNotice}</p>}

      {ent && validateEnt(ent) && <p role="status" className="text-xs text-warning">{validateEnt(ent)}</p>}
      {!ent && <p className="rounded-ui-lg bg-primary-soft px-2 py-2 text-xs text-primary">Select Eye, Nose or Ear to configure this label.</p>}

    </section>
  );
}
