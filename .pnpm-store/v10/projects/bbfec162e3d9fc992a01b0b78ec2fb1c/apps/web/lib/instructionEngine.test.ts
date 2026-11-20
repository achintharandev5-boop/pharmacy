import { afterEach, describe, expect, it } from 'vitest';
import {
  analyseAdministration,
  currentAdministrationText,
  specAdministrationText,
  setWordingModeForTests,
  getWordingMode,
} from './instructionEngine';
import { buildFinalInstruction } from './labelBuilder';

/**
 * Workflow matrix for the handwritten specifications (docs/LABEL_WORKFLOW_TEST_REPORT.md).
 *
 * Expected Sinhala strings are copied from the sheets (NAB, OAB, "Software Logic" PDFs), not
 * from the implementation. Spec wording is not printed until approved; these tests prove the
 * engine produces exactly the sheet text when it is switched on, and that today's printed text
 * is unchanged while it is off.
 */

const ZERO = { morning: { qty: 0 }, lunch: { qty: 0 }, night: { qty: 0 } };
const MORNING_1 = { morning: { qty: 1 }, lunch: { qty: 0 }, night: { qty: 0 } };

afterEach(() => setWordingModeForTests(null));

describe('wording switch', () => {
  it('defaults to the current wording', () => {
    expect(getWordingMode()).toBe('current');
  });
});

describe('spec wording: Normal Administration (NAB sheet)', () => {
  it.each([
    [['TAKE', 'AFTER'], 'ගන්න කෑමට පසු'],
    [['TAKE', 'BEFORE'], 'ගන්න කෑමට පෙර'],
    [['GIVE', 'AFTER'], 'දෙන්න කෑමට පසු'],
    [['GIVE', 'BEFORE'], 'දෙන්න කෑමට පෙර'],
  ])('%j → %s', (tags, sinhala) => {
    const a = analyseAdministration(tags, ZERO, 'spec');
    expect(a).toMatchObject({ workflow: 'NAB', status: 'complete', text: sinhala });
  });

  it('TAKE alone is incomplete and produces no sentence', () => {
    const a = analyseAdministration(['TAKE'], ZERO, 'spec');
    expect(a).toMatchObject({ status: 'incomplete', missing: ['BEFORE_OR_AFTER'], nextStep: 'Choose BEFORE or AFTER', text: null });
  });

  it('BEFORE alone is incomplete (no unapproved "කෑමට පෙර ගන්න")', () => {
    const a = analyseAdministration(['BEFORE'], ZERO, 'spec');
    expect(a).toMatchObject({ status: 'incomplete', missing: ['TAKE_OR_GIVE'], text: null });
  });
});

describe('spec wording: Other Administration (OAB sheet)', () => {
  it.each([
    // Chewable [හපලා] · take [කන්න] · give [කන්න දෙන්න] · [කෑමට] · [පසු]/[පෙර]
    [['CHEWABLE', 'TAKE', 'AFTER'], 'හපලා කන්න කෑමට පසු'],
    [['CHEWABLE', 'TAKE', 'BEFORE'], 'හපලා කන්න කෑමට පෙර'],
    [['CHEWABLE', 'GIVE', 'AFTER'], 'හපලා කන්න දෙන්න කෑමට පසු'],
    [['CHEWABLE', 'GIVE', 'BEFORE'], 'හපලා කන්න දෙන්න කෑමට පෙර'],
    // Keep in Mouth [දිව මත] · take [තබා ගන්න] · give [තබන්න]
    [['KEEP IN MOUTH', 'TAKE', 'BEFORE'], 'දිව මත තබා ගන්න කෑමට පෙර'],
    [['KEEP IN MOUTH', 'TAKE', 'AFTER'], 'දිව මත තබා ගන්න කෑමට පසු'],
    [['KEEP IN MOUTH', 'GIVE', 'BEFORE'], 'දිව මත තබන්න කෑමට පෙර'],
    [['KEEP IN MOUTH', 'GIVE', 'AFTER'], 'දිව මත තබන්න කෑමට පසු'],
    // Dissolve and Drink [දිය කර] · take [බොන්න] · give [බොන්න දෙන්න]
    [['DISSOLVE AND DRINK', 'TAKE', 'BEFORE'], 'දිය කර බොන්න කෑමට පෙර'],
    [['DISSOLVE AND DRINK', 'TAKE', 'AFTER'], 'දිය කර බොන්න කෑමට පසු'],
    [['DISSOLVE AND DRINK', 'GIVE', 'BEFORE'], 'දිය කර බොන්න දෙන්න කෑමට පෙර'],
    [['DISSOLVE AND DRINK', 'GIVE', 'AFTER'], 'දිය කර බොන්න දෙන්න කෑමට පසු'],
    // Empty Stomach [හිස් බඩ] and With Food [කෑමත් සමඟ]: no timing
    [['EMPTY STOMACH', 'TAKE'], 'හිස් බඩ ගන්න'],
    [['EMPTY STOMACH', 'GIVE'], 'හිස් බඩ දෙන්න'],
    [['WITH FOOD', 'TAKE'], 'කෑමත් සමඟ ගන්න'],
    [['WITH FOOD', 'GIVE'], 'කෑමත් සමඟ දෙන්න'],
    // With Food then Chewable
    [['WITH FOOD', 'CHEWABLE', 'TAKE'], 'කෑමත් සමඟ හපලා කන්න'],
    [['WITH FOOD', 'CHEWABLE', 'GIVE'], 'කෑමත් සමඟ හපලා කන්න දෙන්න'],
  ])('%j → %s', (tags, sinhala) => {
    const a = analyseAdministration(tags, ZERO, 'spec');
    expect(a.status).toBe('complete');
    expect(a.text).toBe(sinhala);
  });

  it.each([
    [['CHEWABLE'], ['TAKE_OR_GIVE', 'BEFORE_OR_AFTER']],
    [['CHEWABLE', 'TAKE'], ['BEFORE_OR_AFTER']],
    [['KEEP IN MOUTH', 'GIVE'], ['BEFORE_OR_AFTER']],
    [['DISSOLVE AND DRINK'], ['TAKE_OR_GIVE', 'BEFORE_OR_AFTER']],
    [['EMPTY STOMACH'], ['TAKE_OR_GIVE']],
    [['WITH FOOD'], ['TAKE_OR_GIVE']],
    [['WITH FOOD', 'CHEWABLE'], ['TAKE_OR_GIVE']],
  ])('%j is incomplete, missing %j, and prints nothing', (tags, missing) => {
    const a = analyseAdministration(tags, ZERO, 'spec');
    expect(a.status).toBe('incomplete');
    expect(a.missing).toEqual(missing);
    expect(a.text).toBeNull();
  });

  it('Empty Stomach and With Food never ask for BEFORE/AFTER ("locked automatically")', () => {
    expect(analyseAdministration(['EMPTY STOMACH', 'TAKE'], ZERO, 'spec').missing).toEqual([]);
    expect(analyseAdministration(['WITH FOOD', 'GIVE'], ZERO, 'spec').missing).toEqual([]);
  });

  it('Chewable then With Food is invalid and prints nothing', () => {
    const a = analyseAdministration(['CHEWABLE', 'WITH FOOD', 'TAKE'], ZERO, 'spec');
    expect(a.status).toBe('invalid');
    expect(a.problems[0]).toContain('Chewable then With Food is not a supported order');
    expect(a.text).toBeNull();
  });
});

describe('spec rule: Digital label locks 6H / 8H / 5H / Daily', () => {
  it.each(['5H', '6H', '8H', 'DAILY'])('%s with a Morning dose is invalid', (code) => {
    const a = analyseAdministration([code, 'TAKE', 'AFTER'], MORNING_1, 'spec');
    expect(a.status).toBe('invalid');
    expect(a.text).toBeNull();
  });

  it('EVENING is not locked by the sheet', () => {
    expect(analyseAdministration(['EVENING', 'TAKE', 'AFTER'], MORNING_1, 'spec').status).toBe('complete');
  });

  it('intervals without a dose row are fine', () => {
    expect(analyseAdministration(['8H', 'GIVE', 'BEFORE'], ZERO, 'spec')).toMatchObject({ status: 'complete', text: 'දෙන්න කෑමට පෙර' });
  });
});

describe('current wording is unchanged (what prints today)', () => {
  it.each([
    [['TAKE', 'AFTER'], 'කෑමට පසු ගන්න'],
    [['TAKE', 'BEFORE'], 'කෑමට පෙර ගන්න'],
    [['GIVE', 'AFTER'], 'කෑමට පසු දෙන්න'],
    [['GIVE', 'BEFORE'], 'කෑමට පෙර දෙන්න'],
    [['CHEWABLE', 'TAKE', 'BEFORE'], 'සපලා කන්න කෑමට පෙර'],
    [['CHEWABLE', 'GIVE', 'AFTER'], 'සපලා කන්න දෙන්න කෑමට පසු'],
    [['DISSOLVE AND DRINK', 'TAKE', 'AFTER'], 'දිය කර බොන්න කෑමට පසු'],
    [['WITH FOOD', 'TAKE'], 'කෑමත් සමඟ ගන්න'],
    [['WITH FOOD', 'GIVE'], 'කෑමත් සමඟ දෙන්න'],
    [['EMPTY STOMACH', 'TAKE'], 'හිස් බඩ ගන්න'],
    [['EMPTY STOMACH', 'GIVE'], 'හිස් බඩ දෙන්න'],
    // Partial selections (DONE refuses these, but they show in the preview today)
    [['BEFORE'], null],
    [['WITH FOOD'], null],
    [['EMPTY STOMACH'], null],
    [['CHEWABLE'], null],
    [['DISSOLVE AND DRINK'], null],
    [['CHEWABLE', 'TAKE'], null],
    [['KEEP IN MOUTH', 'TAKE', 'AFTER'], 'දිව මත තබා ගන්න කෑමට පසු'],
  ])('%j → %s', (tags, sinhala) => {
    expect(currentAdministrationText(tags)).toBe(sinhala);
  });

  it('the label builder folds Keep in Mouth into the shared Sinhala sentence in current mode', () => {
    const out = buildFinalInstruction({ additionalInstructions: ['KEEP IN MOUTH', 'TAKE', 'AFTER'], dosage: ZERO });
    expect(out.additionalInstructions).toEqual(['දිව මත තබා ගන්න කෑමට පසු']);
  });

  it('current wording requires Keep in Mouth administration steps', () => {
    expect(analyseAdministration(['KEEP IN MOUTH'], ZERO, 'current').status).toBe('incomplete');
    expect(analyseAdministration(['WITH FOOD', 'CHEWABLE', 'TAKE'], ZERO, 'current').workflow).toBe('WITH FOOD + CHEWABLE');
    expect(analyseAdministration(['8H', 'TAKE', 'AFTER'], ZERO, 'current').status).toBe('complete');
    expect(analyseAdministration(['8H', 'TAKE', 'AFTER'], MORNING_1, 'current').status).toBe('invalid');
  });
});

describe('label builder under the spec wording', () => {
  it('prints the sheet sentence once, with Keep in Mouth folded into it', () => {
    setWordingModeForTests('spec');
    const out = buildFinalInstruction({ additionalInstructions: ['KEEP IN MOUTH', 'GIVE', 'BEFORE'], dosage: ZERO });
    expect(out.additionalInstructions).toEqual(['දිව මත තබන්න කෑමට පෙර']);
  });

  it('prints no administration sentence for an incomplete workflow', () => {
    setWordingModeForTests('spec');
    const out = buildFinalInstruction({ additionalInstructions: ['CHEWABLE', 'TAKE'], dosage: ZERO });
    expect(out.additionalInstructions).toEqual([]);
  });

  it('spec text is available for review in either mode', () => {
    expect(specAdministrationText(['TAKE', 'AFTER'])).toBe('ගන්න කෑමට පසු');
    expect(analyseAdministration(['TAKE', 'AFTER'], ZERO, 'current').specText).toBe('ගන්න කෑමට පසු');
  });
});

describe('interval and daily quantity ("Select Qty")', () => {
  it.each(['5H', '6H', '8H', 'DAILY', 'EVENING'])('%s without a quantity is incomplete in both wordings', (code) => {
    for (const mode of ['current', 'spec'] as const) {
      const a = analyseAdministration([code], ZERO, mode, 0);
      expect(a.missing[0]).toBe('QUANTITY');
      expect(a.nextStep).toBe(`Enter the quantity for ${code}`);
      expect(a.status).toBe('incomplete');
    }
  });

  it('with a quantity, current wording still requires ordinary administration', () => {
    expect(analyseAdministration(['8H'], ZERO, 'current', 1)).toMatchObject({ status: 'incomplete', missing: ['TAKE_OR_GIVE', 'BEFORE_OR_AFTER'] });
  });

  it('spec: a schedule continues into NAB/OAB before there is an output', () => {
    expect(analyseAdministration(['8H'], ZERO, 'spec', 1)).toMatchObject({ status: 'incomplete', missing: ['TAKE_OR_GIVE', 'BEFORE_OR_AFTER'] });
    expect(analyseAdministration([], MORNING_1, 'spec')).toMatchObject({ status: 'incomplete', missing: ['TAKE_OR_GIVE', 'BEFORE_OR_AFTER'] });
    expect(analyseAdministration(['TAKE', 'AFTER'], MORNING_1, 'spec').status).toBe('complete');
  });

  it('current wording requires administration for an oral Morning dose', () => {
    expect(analyseAdministration([], MORNING_1, 'current')).toMatchObject({ status: 'incomplete', nextStep: 'Choose TAKE or GIVE' });
  });
});
