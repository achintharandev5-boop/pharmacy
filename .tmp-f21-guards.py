from pathlib import Path
p=Path('apps/web/lib/reasons.ts');s=p.read_text(encoding='utf-8');a=s.index('export function reasonsProblem');b=s.index('\nconst ADMINISTRATION',a);s=s[:a]+'''export function reasonStateProblem(label: ReasonState): string | null {
  if (label.reasonsEditPending) return 'Confirm at least one reason with Enter, or cancel Reasons.';
  const reasons = selectedReasonTexts(label);
  if (!reasons.length) return null;
  const problem = reasonValuesProblem(reasons);
  if (problem) return problem;
  return label.reasonsConfirmed === true ? null : 'Review the selected reasons and confirm with Enter.';
}
export function reasonsProblem(label: ReasonState, catalogue: readonly string[] | null | undefined): string | null {
  const problem = reasonStateProblem(label);
  if (problem) return problem;
  const reasons = selectedReasonTexts(label);
  if (!reasons.length) return null;
  if (!catalogue) return 'Load the configured reason catalogue before completing this label.';
  return reasons.some(r => !catalogue.includes(r)) ? 'Remove unavailable reasons and select the current configured statements.' : null;
}
'''+s[b:];p.write_text(s,encoding='utf-8')
p=Path('apps/web/lib/instructionEngine.ts');s=p.read_text(encoding='utf-8');s="import { reasonStateProblem } from './reasons';\nexport { reasonsProblem as reasonsPrintError } from './reasons';\n"+s;s=s.replace('    selectedDaysOfWeek?: string[];', '    reasons?: string[];\n    reason?: string | null;\n    reasonsConfirmed?: boolean;\n    reasonsEditPending?: boolean;\n    selectedDaysOfWeek?: string[];');s=s.replace('blocking = daysProblem(label) ??', 'blocking = reasonStateProblem(label) ?? daysProblem(label) ??');p.write_text(s,encoding='utf-8')
p=Path('apps/web/components/label/InstructionGrid.tsx');s=p.read_text(encoding='utf-8');s=s.replace("import { formatDays,", "import { reasonSelectionRefusal } from '../../lib/reasons';\nimport { formatDays,");s=s.replace('const chewingLock = daySelectionRefusal(activeLabel, tile.key)', 'const chewingLock = reasonSelectionRefusal(activeLabel, tile.key) ?? daySelectionRefusal(activeLabel, tile.key)');s=s.replace('isReasonsOpen ? closeReasonsPanel() : openReasonsPanel()', 'isReasonsOpen ? useLabelStore.getState().cancelReasonsPanel() : openReasonsPanel()');s=s.replace('  const closeReasonsPanel = useLabelStore((state) => state.closeReasonsPanel);\n','');s=s.replace("key: 'ENT', disabled: isStatFlow ||", "key: 'ENT', disabled: isStatFlow || Boolean(reasonSelectionRefusal(useLabelStore.getState().labels[useLabelStore.getState().activeLabelIndex], 'ENT')) ||");p.write_text(s,encoding='utf-8')
p=Path('apps/web/components/label/LabelActions.tsx');s=p.read_text(encoding='utf-8');s=s.replace("import React from 'react';", "import React from 'react';\nimport { reasonSelectionRefusal } from '../../lib/reasons';");s=s.replace('  const additionalInstructions =', '  const activeLabel = useLabelStore(state => state.labels[state.activeLabelIndex]);\n  const additionalInstructions =',1);s=s.replace('const disabled = isStatActive || locked;', 'const disabled = isStatActive || locked || Boolean(reasonSelectionRefusal(activeLabel, b.key));');p.write_text(s,encoding='utf-8')
p=Path('apps/web/components/label/DosagePanel.tsx');s=p.read_text(encoding='utf-8');s=s.replace("import { dosageText,", "import { reasonSelectionRefusal } from '../../lib/reasons';\nimport { dosageText,");s=s.replace("Boolean(daySelectionRefusal(activeLabel, 'DIGITAL')", "Boolean(reasonSelectionRefusal(activeLabel, 'DIGITAL') ?? daySelectionRefusal(activeLabel, 'DIGITAL')");p.write_text(s,encoding='utf-8')
p=Path('apps/web/store/labelStore.ts');s=p.read_text(encoding='utf-8');s=s.replace("      if (!target) return;\n\n      // 'clear'", "      if (!target) return;\n      if (['morning_fraction', 'lunch_fraction', 'night_fraction'].includes(target) && reasonSelectionRefusal(activeLabel() ?? {}, 'DIGITAL')) return;\n\n      // 'clear'");p.write_text(s,encoding='utf-8')
for file in ['apps/web/app/label/page.tsx','apps/web/components/label/LabelActionPage.tsx']:
 p=Path(file);s=p.read_text(encoding='utf-8').replace('weeklyPrintError, daysPrintError,', 'weeklyPrintError, reasonsPrintError, daysPrintError,')
 if file.endswith('/page.tsx'):
  s=s.replace('const engineMessage = daysPrintError', 'const engineMessage = reasonsPrintError(label, currentState.reasonCatalogue) ?? daysPrintError')
  guard='''    const reasonState = useLabelStore.getState();
    const reasonIndex = reasonState.labels.findIndex(label => reasonsPrintError(label, reasonState.reasonCatalogue));
    if (reasonIndex !== -1) {
      setSaveError(`Not saved, nothing printed: label ${reasonIndex + 1}: ${reasonsPrintError(reasonState.labels[reasonIndex], reasonState.reasonCatalogue)}`);
      return;
    }
'''
  s=s.replace('    const dayState = useLabelStore.getState();', guard+'    const dayState = useLabelStore.getState();')
 else:
  s=s.replace('  const dayErrors =', "  const reasonCatalogue = useLabelStore(state => state.reasonCatalogue);\n  const reasonErrors = labels.flatMap((label, index) => {\n    const error = reasonsPrintError(label, reasonCatalogue);\n    return error ? [`Label ${index + 1}: ${error}`] : [];\n  });\n  const dayErrors =")
  s=s.replace('dayErrors.length > 0', 'reasonErrors.length > 0 || dayErrors.length > 0')
  s=s.replace('=> daysPrintError(label,', '=> reasonsPrintError(label, useLabelStore.getState().reasonCatalogue) || daysPrintError(label,')
  s=s.replace('{reasonErrors.length > 0 || dayErrors.length > 0 && <div', '{dayErrors.length > 0 && <div')
  s=s.replace('        {dailyErrors.length > 0 &&', '        {reasonErrors.length > 0 && <div role="alert" data-testid="reasons-validation-blocked" className="text-danger">Saving and printing are blocked: {reasonErrors.join(\' \')}</div>}\n        {dailyErrors.length > 0 &&')
  s=s.replace('weeklyErrors.length || dayErrors.length ||', 'weeklyErrors.length || reasonErrors.length || dayErrors.length ||').replace('...weeklyErrors, ...dayErrors,', '...weeklyErrors, ...reasonErrors, ...dayErrors,')
 p.write_text(s,encoding='utf-8')
