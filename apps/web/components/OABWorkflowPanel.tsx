'use client';

import React, { useState } from 'react';
import {
  InstructionCategory,
  AdminAction,
  MealTiming,
  getInstruction
} from '../constants/oabInstructions';

interface OABWorkflowPanelProps {
  onInstructionGenerated?: (sentence: string) => void;
  className?: string;
}

export function OABWorkflowPanel({ onInstructionGenerated, className = '' }: OABWorkflowPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<InstructionCategory | null>(null);
  const [selectedAction, setSelectedAction] = useState<AdminAction | null>(null);
  const [selectedTiming, setSelectedTiming] = useState<MealTiming | null>(null);
  const [printedSentence, setPrintedSentence] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if timing options should be locked
  const isTimingLocked = selectedCategory === 'withFood' || selectedCategory === 'emptyStomach';

  const handleCategorySelect = (category: InstructionCategory) => {
    setSelectedCategory(category);
    setPrintedSentence(null);
    setErrorMessage(null);
    // Auto-clear timing if switching to category where timing is locked
    if (category === 'withFood' || category === 'emptyStomach') {
      setSelectedTiming(null);
    }
  };

  const handleActionSelect = (action: AdminAction) => {
    setSelectedAction(action);
    setPrintedSentence(null);
    setErrorMessage(null);
  };

  const handleTimingSelect = (timing: MealTiming) => {
    if (isTimingLocked) return;
    setSelectedTiming(timing);
    setPrintedSentence(null);
    setErrorMessage(null);
  };

  const handleGivePrint = () => {
    if (!selectedCategory) {
      setErrorMessage('Please select a medicine instruction type category.');
      setPrintedSentence(null);
      return;
    }

    if (!selectedAction) {
      setErrorMessage('Please select TAKE or GIVE action.');
      setPrintedSentence(null);
      return;
    }

    if (!isTimingLocked && !selectedTiming) {
      setErrorMessage('Please select BEFORE or AFTER meal timing option.');
      setPrintedSentence(null);
      return;
    }

    const sentence = getInstruction(selectedCategory, selectedAction, selectedTiming);
    if (sentence) {
      setPrintedSentence(sentence);
      setErrorMessage(null);
      if (onInstructionGenerated) {
        onInstructionGenerated(sentence);
      }
    } else {
      setErrorMessage('Invalid selection combination.');
      setPrintedSentence(null);
    }
  };

  const handleReset = () => {
    setSelectedCategory(null);
    setSelectedAction(null);
    setSelectedTiming(null);
    setPrintedSentence(null);
    setErrorMessage(null);
  };

  return (
    <div className={`bg-white border-2 border-border rounded-ui-lg p-5 shadow-sm space-y-5 ${className}`}>
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="text-xl font-bold text-fg">Software Logic For OAB</h2>
          <p className="text-xs text-subtle">Button-driven medicine instruction selection</p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-semibold px-3 py-1.5 bg-surface-2 text-muted rounded-lg hover:bg-border transition-colors"
        >
          Reset Workflow
        </button>
      </div>

      {/* STEP 1: CATEGORY SELECTION */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-subtle">
          1. Select Medicine Instruction Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleCategorySelect('chewable')}
            className={`py-3 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
              selectedCategory === 'chewable'
                ? 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                : 'bg-surface text-muted border-border hover:border-border-strong'
            }`}
          >
            <div>CHEWABLE</div>
            <div className="text-[11px] font-normal opacity-80">සපාකන්න</div>
          </button>

          <button
            type="button"
            onClick={() => handleCategorySelect('dissolveAndDrink')}
            className={`py-3 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
              selectedCategory === 'dissolveAndDrink'
                ? 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                : 'bg-surface text-muted border-border hover:border-border-strong'
            }`}
          >
            <div>DISSOLVE & DRINK</div>
            <div className="text-[11px] font-normal opacity-80">දියකර බොන්න</div>
          </button>

          <button
            type="button"
            onClick={() => handleCategorySelect('withFood')}
            className={`py-3 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
              selectedCategory === 'withFood'
                ? 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                : 'bg-surface text-muted border-border hover:border-border-strong'
            }`}
          >
            <div>WITH FOOD</div>
            <div className="text-[11px] font-normal opacity-80">කෑමත් සමග</div>
          </button>

          <button
            type="button"
            onClick={() => handleCategorySelect('emptyStomach')}
            className={`py-3 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
              selectedCategory === 'emptyStomach'
                ? 'bg-primary text-white border-primary shadow-md scale-[1.02]'
                : 'bg-surface text-muted border-border hover:border-border-strong'
            }`}
          >
            <div>EMPTY STOMACH</div>
            <div className="text-[11px] font-normal opacity-80">හිස් බඩ</div>
          </button>
        </div>
      </div>

      {/* STEP 2: OPTIONS (TAKE / GIVE & TIMING) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* ACTION OPTIONS */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-subtle">
            2. Action (TAKE / GIVE)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!selectedCategory}
              onClick={() => handleActionSelect('take')}
              className={`py-2.5 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
                !selectedCategory ? 'opacity-40 cursor-not-allowed bg-surface-2 border-border text-subtle' :
                selectedAction === 'take'
                  ? 'bg-success text-white border-success shadow'
                  : 'bg-surface text-muted border-border hover:border-border-strong'
              }`}
            >
              TAKE (ගන්න)
            </button>

            <button
              type="button"
              disabled={!selectedCategory}
              onClick={() => handleActionSelect('give')}
              className={`py-2.5 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
                !selectedCategory ? 'opacity-40 cursor-not-allowed bg-surface-2 border-border text-subtle' :
                selectedAction === 'give'
                  ? 'bg-success text-white border-success shadow'
                  : 'bg-surface text-muted border-border hover:border-border-strong'
              }`}
            >
              GIVE (දෙන්න)
            </button>
          </div>
        </div>

        {/* MEAL TIMING OPTIONS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-subtle">
              3. Timing (BEFORE / AFTER)
            </label>
            {isTimingLocked && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-100 text-warning rounded">
                Locked / N/A
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!selectedCategory || isTimingLocked}
              onClick={() => handleTimingSelect('before')}
              className={`py-2.5 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
                isTimingLocked || !selectedCategory
                  ? 'bg-surface-2 border-border text-subtle cursor-not-allowed opacity-50'
                  : selectedTiming === 'before'
                  ? 'bg-primary text-white border-primary shadow'
                  : 'bg-surface text-muted border-border hover:border-border-strong'
              }`}
            >
              BEFORE (පෙර)
            </button>

            <button
              type="button"
              disabled={!selectedCategory || isTimingLocked}
              onClick={() => handleTimingSelect('after')}
              className={`py-2.5 px-3 rounded-ui-lg font-bold text-sm text-center border-2 transition-all ${
                isTimingLocked || !selectedCategory
                  ? 'bg-surface-2 border-border text-subtle cursor-not-allowed opacity-50'
                  : selectedTiming === 'after'
                  ? 'bg-primary text-white border-primary shadow'
                  : 'bg-surface text-muted border-border hover:border-border-strong'
              }`}
            >
              AFTER (පසු)
            </button>
          </div>
        </div>
      </div>

      {/* STEP 3: GIVE / PRINT ACTION BUTTON */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleGivePrint}
          className="w-full py-3 px-4 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-extrabold rounded-ui-lg text-lg shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>GIVE / PRINT</span>
        </button>
      </div>

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-3 bg-danger-soft border border-danger-border rounded-ui-lg text-xs font-semibold text-danger">
          {errorMessage}
        </div>
      )}

      {/* OUTPUT PRINTED SENTENCE DISPLAY */}
      {printedSentence && (
        <div className="p-4 bg-success-soft border-2 border-emerald-400 rounded-ui-lg space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-success">
            PRINT OUTPUT INSTRUCTION:
          </div>
          <div className="text-xl font-extrabold text-success font-serif">
            {printedSentence}
          </div>
        </div>
      )}
    </div>
  );
}
