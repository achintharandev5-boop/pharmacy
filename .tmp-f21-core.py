from pathlib import Path
p=Path('apps/web/store/labelStore.ts');s=p.read_text(encoding='utf-8');s="import { reasonSelectionRefusal, reasonValuesProblem, selectedReasonTexts } from '../lib/reasons';\n"+s
# Only LabelData owns workflow flags; the existing active mirror of text remains intact.
s=s.replace('  reasons: string[];\n  expiryDate:', '  reasons: string[];\n  reasonsConfirmed?: boolean;\n  reasonsEditPending?: boolean;\n  expiryDate:',1)
s=s.replace('    reasons: [],\n    expiryDate:', '    reasons: [],\n    reasonsConfirmed: false,\n    reasonsEditPending: false,\n    expiryDate:',1)
s=s.replace('  setReason: (reason: string | null) => void;', "  reasonCatalogue: string[] | null;\n  setReasonCatalogue: (reasons: string[] | null) => void;\n  reasonsBeforeEdit?: Pick<LabelData, 'reason' | 'reasons' | 'reasonsConfirmed' | 'reasonsEditPending'> | null;\n  cancelReasonsPanel: () => void;\n  setReason: (reason: string | null) => void;")
s=s.replace('  weekdayRangeBeforeEdit: null,\n  rangeEndpoint:', '  weekdayRangeBeforeEdit: null,\n  reasonsBeforeEdit: null,\n  rangeEndpoint:')
s=s.replace('  if (restored === current) return state.labels;', "  if (state.reasonsBeforeEdit) restored = { ...restored, ...state.reasonsBeforeEdit };\n  if (restored === current) return state.labels;")
s=s.replace("    customerName: '',\n    customerPhone: '',", "    reasonCatalogue: null,\n    customerName: '',\n    customerPhone: '',",1)
a=s.index('    setReason: (reason) =>');b=s.index('    setExpiryDate:',a)
s=s[:a]+'''    setReasonCatalogue: (reasons) => set({ reasonCatalogue: reasons && reasons.every(r => typeof r === 'string' && r.trim() && r.length <= 200) && new Set(reasons).size === reasons.length ? [...reasons] : null }),
    setReason: (reason) => get().setReasons(reason ? [reason] : []),
    setReasons: (reasons) => {
      const label = activeLabel();
      if (!label || isStatStep(get().activeControl) || reasonValuesProblem(reasons)) return;
      const current = selectedReasonTexts(label);
      if (reasons.some(r => !current.includes(r) && (!label.reasonsEditPending || !get().reasonCatalogue?.includes(r)))) { set({ workflowNotice: 'Select only configured reasons in the Reasons panel.' }); return; }
      updateActiveLabel(() => ({ reasons: [...reasons], reason: reasons.length ? reasons.join(', ') : null, reasonsConfirmed: false }));
    },
    toggleReason: (reason) => {
      const label = activeLabel(); if (!label) return;
      const current = selectedReasonTexts(label);
      get().setReasons(current.includes(reason) ? current.filter(r => r !== reason) : [...current, reason]);
    },
    clearReasons: () => {
      if (isStatStep(get().activeControl)) return;
      updateActiveLabel(() => ({ reasons: [], reason: null, reasonsConfirmed: false, reasonsEditPending: false }));
      set({ reasonsBeforeEdit: null, ...(get().activeControl === 'reasons' ? { activeControl: 'idle' as ActiveControl } : {}) });
    },
    openReasonsPanel: () => {
      if (isStatStep(get().activeControl) || get().numberPad.visible || get().activeControl === 'days_of_week') { set({ workflowNotice: 'Finish or cancel the current entry before selecting Reasons.' }); return; }
      const label = activeLabel(); if (!label) return;
      if (!get().reasonsBeforeEdit) set({ reasonsBeforeEdit: { reasons: [...selectedReasonTexts(label)], reason: label.reason, reasonsConfirmed: label.reasonsConfirmed, reasonsEditPending: label.reasonsEditPending } });
      updateActiveLabel(() => ({ reasonsEditPending: true }));
      set({ activeControl: 'reasons', numberPad: CLOSED_PAD, workflowNotice: null });
    },
    closeReasonsPanel: () => {
      const label = activeLabel(); if (!label?.reasonsEditPending) return;
      const reasons = selectedReasonTexts(label);
      const problem = reasonValuesProblem(reasons);
      if (!reasons.length || problem || !get().reasonCatalogue || reasons.some(r => !get().reasonCatalogue!.includes(r))) { set({ workflowNotice: problem ?? 'Select at least one configured reason, then Enter; or omit/cancel Reasons.' }); return; }
      updateActiveLabel(() => ({ reasonsConfirmed: true, reasonsEditPending: false }));
      set({ activeControl: 'idle', reasonsBeforeEdit: null, workflowNotice: null });
    },
    cancelReasonsPanel: () => {
      const before = get().reasonsBeforeEdit;
      if (before) updateActiveLabel(() => before);
      set({ activeControl: 'idle', reasonsBeforeEdit: null, workflowNotice: null });
    },

'''+s[b:]
s=s.replace("selection && hasWeekdayRange(label) ? {}", "selection && (hasWeekdayRange(label) || reasonSelectionRefusal(label, 'ENT')) ? {}")
s=s.replace("const refusal = daySelectionRefusal(activeLabel() ?? {}, 'DIGITAL')", "const refusal = reasonSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? daySelectionRefusal(activeLabel() ?? {}, 'DIGITAL')")
s=s.replace('if (daySelectionRefusal(label,', "if (reasonSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? daySelectionRefusal(label,")
s=s.replace('const chewingRefusal = daySelectionRefusal(before, instruction)', 'const chewingRefusal = reasonSelectionRefusal(before, instruction) ?? daySelectionRefusal(before, instruction)')
s=s.replace('clearDosage: (target) => updateActiveLabel((label) => ({', "clearDosage: (target) => updateActiveLabel((label) => reasonSelectionRefusal(label, 'DIGITAL') ? {} : ({")
s=s.replace("decrementDosage: (target) => updateActiveLabel((label) => {", "decrementDosage: (target) => updateActiveLabel((label) => {\n      if (target !== 'stat' && reasonSelectionRefusal(label, 'DIGITAL')) return {};")
s=s.replace('      reasons: [],\n      reason: null,\n      stat:', '      reasons: [],\n      reasonsConfirmed: false,\n      reasonsEditPending: false,\n      reason: null,\n      stat:')
p.write_text(s,encoding='utf-8')
p=Path('apps/web/lib/labelBuilder.ts');s=p.read_text(encoding='utf-8');s="import { formattedReasons } from './reasons';\n"+s;a=s.index('  const selectedReasons =');b=s.index('\n\n',a);s=s[:a]+"  const selectedReasons = formattedReasons(state);"+s[b:];s=s.replace("selectedReasons.length > 0 ? selectedReasons.join(', ') : (state.reason || null)", "selectedReasons.length ? selectedReasons.join('\\n') : null")
s=s.replace('  return output;\n}', "  if (selectedReasons.length) {\n    const reasonText = selectedReasons.join('\\n');\n    output.instructionString = [output.instructionString, reasonText].filter(Boolean).join('\\n');\n    output.finalInstructionText = [output.finalInstructionText, reasonText].filter(Boolean).join('\\n');\n  }\n  return output;\n}",1);p.write_text(s,encoding='utf-8')
p=Path('apps/web/components/PrintableLabel.tsx');s=p.read_text(encoding='utf-8');s=s.replace("  const reasonText = labelItem.reasons?.length ? labelItem.reasons.join(', ') : (labelItem.reason || '');", "  const reasonLines = labelItem.reasons?.length ? labelItem.reasons : (labelItem.reason ? [labelItem.reason] : []);")
s=s.replace('{reasonText && (', '{reasonLines.length > 0 && (');s=s.replace('            ( {reasonText} )', '            {reasonLines.map((text, index) => <div key={index} data-reason-line>{text}</div>)}');s=s.replace('<div className="sinhala-text text-[12px]', '<div data-label-reasons className="sinhala-text text-[12px]');p.write_text(s,encoding='utf-8')
