import { describe, it, expect } from 'vitest';
import { buildFinalInstruction } from './labelBuilder';
import { setWordingModeForTests } from './instructionEngine';

describe('buildFinalInstruction', () => {
  it('handles a simple case (only Morning qty=1)', () => {
    const state = {
      customerName: ' ',
      product: null,
      alternativeProductName: '',
      dosage: {
        morning: { qty: 1, isFraction: false },
        lunch: { qty: 0, isFraction: false },
        night: { qty: 0, isFraction: false }
      },
      stat: null,
      days: null,
      additionalInstructions: []
    };

    const result = buildFinalInstruction(state);
    
    expect(result).toMatchObject({
      dosage: {
        morning: '1'
      }
    });
  });

  it('handles a complex case with everything populated', () => {
    const state = {
      customerName: 'John Doe',
      product: { id: '123', name: 'Paracetamol' },
      alternativeProductName: 'Panadol',
      dosage: {
        morning: { qty: 1.5, isFraction: true },
        lunch: { qty: 0.5, isFraction: true },
        night: { qty: 2, isFraction: false }
      },
      stat: { qty: 2.5, isFraction: true, followUp: '8H' },
      days: 14,
      additionalInstructions: ['BEFORE', 'CHEWABLE', 'TAKE']
    };

    const result = buildFinalInstruction(state);
    
    expect(result).toMatchObject({
      customerName: 'John Doe',
      productName: 'Paracetamol',
      alternativeProductName: 'Panadol',
      dosage: {
        morning: '1½',
        lunch: '½',
        night: '2'
      },
      stat: 'STAT 2½',
      days: 14,
      additionalInstructions: ['පළමුව පමණක් 2½ ගන්න ඉන්පසු,', 'සපලා කන්න කෑමට පෙර']
    });
  });

  it('handles normal administration combination TAKE + BEFORE', () => {
    const state = {
      customerName: 'Jane Doe',
      product: { id: '456', name: 'Amoxicillin' },
      dosage: {
        morning: { qty: 1, isFraction: false },
      },
      additionalInstructions: ['TAKE', 'BEFORE', '6H']
    };

    const result = buildFinalInstruction(state);

    expect(result.additionalInstructions).toEqual(['6H', 'කෑමට පෙර ගන්න']);
  });

  it('handles normal administration combination GIVE + AFTER and suppresses raw control tags', () => {
    const state = {
      additionalInstructions: ['GIVE', 'AFTER']
    };

    const result = buildFinalInstruction(state);

    expect(result.additionalInstructions).toEqual(['කෑමට පසු දෙන්න']);
  });

  it('handles multiple reasons and formats them into reason string and reasons array', () => {
    const state = {
      reasons: ['වමනයට', 'කැස්සට', 'සෙමට']
    };

    const result = buildFinalInstruction(state);

    expect(result.reasons).toEqual(['වමනයට', 'කැස්සට', 'සෙමට']);
    expect(result.reason).toBe('වමනයට\nකැස්සට\nසෙමට');
  });
});

describe('STAT Option B data (statInPhrase): spec wording only, pending pharmacist approval', () => {
  const none = { qty: 0, isFraction: false };
  const base = (stat: { qty: number; isFraction: boolean; followUp: string | null; administration?: string[] }, mode: 'current' | 'spec') => {
    setWordingModeForTests(mode);
    try {
      return buildFinalInstruction({
        dosage: { morning: { qty: 1, isFraction: false }, lunch: none, night: none },
        frequencyDosage: none,
        additionalInstructions: ['STAT', 'TAKE', 'AFTER'],
        stat,
      });
    } finally {
      setWordingModeForTests(null);
    }
  };

  it('keeps the actual quantity, fractions and the follow-up', () => {
    const out = base({ qty: 1.5, isFraction: true, followUp: '8H', administration: ['TAKE'] }, 'spec');
    expect(out.statInPhrase).toEqual({ phrase: 'පළමුව පමණක් 1½ ගන්න ඉන්පසු,', qty: '1½', followUp: null });
    expect(out.additionalInstructions?.[0]).toBe('පළමුව පමණක් 1½ ගන්න ඉන්පසු,');
    expect(out.stat).toBe('STAT 1½');
  });

  it('uses the same initial prefix in current mode', () => {
    expect(base({ qty: 2, isFraction: false, followUp: null, administration: ['TAKE'] }, 'current').statInPhrase?.phrase).toBe('පළමුව පමණක් 2 ගන්න ඉන්පසු,');
  });

  it.each([[['GIVE']], [['TAKE', 'BEFORE']], [['TAKE', 'AFTER']]])('is not set for unapproved STAT administration %j', (administration) => {
    expect(base({ qty: 2, isFraction: false, followUp: null, administration }, 'spec').statInPhrase).toBeUndefined();
  });
});
