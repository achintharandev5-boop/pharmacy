'use client';

import React from 'react';
import { DAY_NAMES, dayValuesProblem, validWeekday, rangeSelectionRefusal, RANGE_CODE } from '../../lib/nameOfDays';
import { useLabelStore, CALENDAR_DAYS } from '../../store/labelStore';
import { Calendar, CalendarDays, CalendarPlus, CheckCircle2, Circle, Check, X } from 'lucide-react';

const DAYS_OF_WEEK = CALENDAR_DAYS;

export function DaysOfWeekPanel() {
  const { selectedDaysOfWeek, toggleDayOfWeek, closeDaysOfWeekPanel, cancelDaysOfWeekPanel, removeDaysOfWeek, setDaysOfWeek } =
    useLabelStore();
  const range = useLabelStore(state => state.labels[state.activeLabelIndex]?.weekdayRange);
  const endpoint = useLabelStore(state => state.rangeEndpoint ?? 'end');
  const selectedEndpoint = range?.[endpoint];
  const problem = range ? (validWeekday(selectedEndpoint) ? null : `Select the ${endpoint} weekday.`) : dayValuesProblem(selectedDaysOfWeek);

  const isAllSelected = DAYS_OF_WEEK.every((d) => selectedDaysOfWeek.includes(d));

  // Till to the Day and Edit start day (formerly grid buttons). Each runs the existing handlers in
  // the order the old buttons required: confirm or cancel this panel, then the range action.
  const label = useLabelStore(state => state.labels[state.activeLabelIndex]);
  // Pressing Till to the Day confirms the chosen start day first, so check it as confirmed.
  const rangeRefusal = range || !label ? null : rangeSelectionRefusal({ ...label, daysConfirmed: true }, RANGE_CODE);
  const panelOpen = () => useLabelStore.getState().activeControl === 'days_of_week';
  const tillToTheDay = () => {
    const store = useLabelStore.getState();
    if (range) {
      // Remove the range, as the former tile did: the start day stays selected.
      store.cancelDaysOfWeekPanel();
      useLabelStore.getState().toggleWeekdayRange();
      useLabelStore.getState().openDaysOfWeekPanel();
      return;
    }
    store.closeDaysOfWeekPanel(); // Done for the single start day
    if (panelOpen()) return; // not accepted; the reason is shown
    useLabelStore.getState().toggleWeekdayRange();
    useLabelStore.getState().openDaysOfWeekPanel('end'); // Name of Days for the end day
  };
  const editStartDay = () => {
    const store = useLabelStore.getState();
    if (problem) store.cancelDaysOfWeekPanel(); else store.closeDaysOfWeekPanel();
    if (panelOpen()) return;
    useLabelStore.getState().openDaysOfWeekPanel('start');
  };

  const handleToggleAll = () => setDaysOfWeek(isAllSelected ? [] : [...DAYS_OF_WEEK]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-3 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center shadow-sm">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-fg leading-tight">
              {range ? `Select ${endpoint} day` : 'Select Days'}
            </h3>
          </div>
        </div>

        {/* Quick select all toggle */}
        <button
          type="button"
          disabled={Boolean(range)}
          onClick={handleToggleAll}
          className="disabled:opacity-40 disabled:cursor-not-allowed h-11 px-4 rounded-xl bg-primary-soft hover:bg-primary-soft text-primary text-sm font-bold transition-colors cursor-pointer select-none"
        >
          {isAllSelected ? 'Clear All' : 'Select All'}
        </button>
      </div>

      {/* Mode: weekdays (Name of Days) or a weekday range (Till to the Day) */}
      <div role="group" aria-label="Day selection mode" className="flex items-center gap-2 shrink-0 mb-1.5">
        <button
          type="button"
          onClick={tillToTheDay}
          aria-pressed={Boolean(range)}
          disabled={Boolean(rangeRefusal)}
          title={rangeRefusal ?? (range ? 'Remove the range and keep the start day' : 'Use the chosen day as the start day, then choose the end day')}
          className={`flex-1 h-12 rounded-ui-lg border-2 flex items-center justify-center gap-1.5 text-sm font-bold transition-colors cursor-pointer select-none touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            range ? 'bg-primary-soft border-primary text-primary' : 'bg-page border-border text-fg hover:border-primary-border'
          }`}
        >
          <CalendarDays size={16} />
          <span>Till to the Day</span>
        </button>
        <button
          type="button"
          onClick={editStartDay}
          disabled={!range || endpoint === 'start'}
          aria-pressed={Boolean(range) && endpoint === 'start'}
          title={!range ? 'Available after Till to the Day' : undefined}
          className={`flex-1 h-12 rounded-ui-lg border-2 flex items-center justify-center gap-1.5 text-sm font-bold transition-colors cursor-pointer select-none touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            range && endpoint === 'start' ? 'bg-primary-soft border-primary text-primary' : 'bg-page border-border text-fg hover:border-primary-border'
          }`}
        >
          <CalendarPlus size={16} />
          <span>Edit start day</span>
        </button>
      </div>
      {rangeRefusal && selectedDaysOfWeek.length === 1 && <p className="text-xs text-subtle shrink-0 mb-1">{rangeRefusal}</p>}

      {/* Days Grid */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 my-1 overflow-y-auto pr-0.5">
        {DAYS_OF_WEEK.map((day) => {
          const isActive = range ? selectedEndpoint === day : selectedDaysOfWeek.includes(day);
          const isSunday = day === 'SUNDAY';

          return (
            <button
              key={DAY_NAMES[day]}
              type="button"
              onClick={() => toggleDayOfWeek(day)}
              aria-pressed={isActive}
              className={`min-h-14 rounded-xl flex items-center justify-between px-4 py-2.5 transition-all select-none touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isSunday ? 'col-span-2' : ''
              } ${
                // Shared selected treatment: tint, 2 px border and a check (not colour alone).
                isActive
                  ? 'bg-primary-soft border-2 border-primary text-fg shadow-sm'
                  : 'bg-page border border-border text-fg hover:bg-surface hover:border-primary-border'
              }`}
            >
              <span lang="si" className="font-bold text-base tracking-wide sinhala-text">
                {DAY_NAMES[day]}
              </span>

              {isActive ? (
                <CheckCircle2 size={24} aria-hidden="true" className="text-primary shrink-0" />
              ) : (
                <Circle size={24} aria-hidden="true" className="text-border-strong shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {range && <p className="text-sm">Start: {validWeekday(range.start) ? DAY_NAMES[range.start] : 'Choose start day'} · End: {validWeekday(range.end) ? DAY_NAMES[range.end] : 'Choose end day'}</p>}
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      {!range && useLabelStore.getState().daysOfWeekBeforeEdit?.length ? <button type="button" onClick={removeDaysOfWeek} className="text-sm text-danger">Remove selected days</button> : null}
      {/* Action Footer */}
      <div className="flex items-center gap-2.5 shrink-0 mt-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={cancelDaysOfWeekPanel}
          className="h-14 px-6 bg-surface hover:bg-surface-2 active:scale-95 text-muted font-bold text-sm rounded-xl transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>

        <button
          type="button"
          onClick={closeDaysOfWeekPanel}
          disabled={Boolean(problem)}
          className="disabled:opacity-40 disabled:cursor-not-allowed flex-1 h-14 bg-success hover:bg-success active:scale-[0.99] text-[var(--color-on-solid)] font-bold text-base rounded-xl shadow-sm transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-2"
        >
          <Check size={20} strokeWidth={2.5} />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}
