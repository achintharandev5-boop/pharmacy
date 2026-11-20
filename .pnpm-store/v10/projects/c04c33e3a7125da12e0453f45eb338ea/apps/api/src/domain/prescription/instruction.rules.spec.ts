import { validateInstructionCombinations } from './instruction.rules';

describe('Instruction Rules Domain', () => {
  it('should pass valid instruction combinations', () => {
    const res = validateInstructionCombinations(['TAKE', 'AFTER', 'CHEWABLE']);
    expect(res.valid).toBe(true);
  });

  it('should reject BEFORE + AFTER combination', () => {
    const res = validateInstructionCombinations(['BEFORE', 'AFTER']);
    expect(res.valid).toBe(false);
    expect(res.message).toContain('BEFORE and AFTER meal timing cannot both be selected');
  });

  it('should reject TAKE + GIVE combination', () => {
    const res = validateInstructionCombinations(['TAKE', 'GIVE']);
    expect(res.valid).toBe(false);
    expect(res.message).toContain('TAKE and GIVE administration options cannot both be selected');
  });

  it('should reject WITH FOOD + EMPTY STOMACH combination', () => {
    const res = validateInstructionCombinations(['WITH FOOD', 'EMPTY STOMACH']);
    expect(res.valid).toBe(false);
    expect(res.message).toContain('WITH FOOD and EMPTY STOMACH cannot both be selected');
  });
});
