import { describe, it, expect, beforeEach } from 'vitest';
import { useLabelStore, parseQty } from './labelStore';

describe('labelStore NumberPad Logic', () => {
  beforeEach(() => {
    useLabelStore.setState({
      activeControl: 'idle',
      numberPad: { visible: false, buffer: '', targetControl: null },
      dosage: {
        morning: { qty: 0, isFraction: false },
        lunch: { qty: 0, isFraction: false },
        night: { qty: 0, isFraction: false },
      }
    });
  });

  it('should remove only the last character on backspace', () => {
    useLabelStore.setState({ numberPad: { visible: true, buffer: '123', targetControl: 'morning' } });
    
    useLabelStore.getState().backspace();
    expect(useLabelStore.getState().numberPad.buffer).toBe('12');
    
    useLabelStore.getState().backspace();
    expect(useLabelStore.getState().numberPad.buffer).toBe('1');
  });

  it('should clear completely on allClear', () => {
    useLabelStore.setState({ numberPad: { visible: true, buffer: '123', targetControl: 'morning' } });
    
    useLabelStore.getState().allClear();
    expect(useLabelStore.getState().numberPad.buffer).toBe('');
  });

  it('should revert unconfirmed number on cancelNumberPad', () => {
    // Initial stable state
    useLabelStore.setState({
      dosage: {
        ...useLabelStore.getState().dosage,
        morning: { qty: 2, isFraction: false }
      }
    });

    useLabelStore.getState().openNumberPad('morning');
    useLabelStore.getState().appendDigit('5'); // buffer is now "5"

    useLabelStore.getState().cancelNumberPad();
    
    // Number pad should be closed
    expect(useLabelStore.getState().numberPad.visible).toBe(false);
    expect(useLabelStore.getState().activeControl).toBe('idle');
    
    // The previous state should be completely untouched
    expect(useLabelStore.getState().dosage.morning.qty).toBe(2);
  });

  it('should commit parsed value on confirmNumberPad', () => {
    useLabelStore.getState().openNumberPad('morning');
    useLabelStore.getState().appendDigit('1');
    useLabelStore.getState().appendFraction(' 1/2'); // "1 1/2"

    useLabelStore.getState().confirmNumberPad();
    
    expect(useLabelStore.getState().numberPad.visible).toBe(false);
    expect(useLabelStore.getState().dosage.morning.qty).toBe(1.5);
    expect(useLabelStore.getState().dosage.morning.isFraction).toBe(true);
  });

  it('cancel without doing anything if buffer is empty on confirmNumberPad', () => {
    useLabelStore.setState({
      dosage: {
        ...useLabelStore.getState().dosage,
        morning: { qty: 2, isFraction: false }
      }
    });

    useLabelStore.getState().openNumberPad('morning');
    useLabelStore.getState().confirmNumberPad(); // confirm empty buffer
    
    expect(useLabelStore.getState().numberPad.visible).toBe(false);
    // Dosage qty remains 2
    expect(useLabelStore.getState().dosage.morning.qty).toBe(2);
  });
});

describe('parseQty helper', () => {
  it('parses normal integers', () => {
    expect(parseQty('2')).toEqual({ qty: 2, isFraction: false });
  });

  it('parses decimal numbers', () => {
    expect(parseQty('2.5')).toEqual({ qty: 2.5, isFraction: false });
  });

  it('parses standalone fractions', () => {
    expect(parseQty('1/2')).toEqual({ qty: 0.5, isFraction: true });
    expect(parseQty('3/4')).toEqual({ qty: 0.75, isFraction: true });
  });

  it('parses mixed fractions', () => {
    expect(parseQty('1 1/2')).toEqual({ qty: 1.5, isFraction: true });
    expect(parseQty('2 3/4')).toEqual({ qty: 2.75, isFraction: true });
  });
});

describe('labelStore Multi-reason Logic', () => {
  beforeEach(() => {
    useLabelStore.getState().allClear();
  });

  it('allows selecting multiple reasons and toggles them off', () => {
    useLabelStore.getState().toggleReason('වමනයට');
    expect(useLabelStore.getState().reasons).toEqual(['වමනයට']);
    expect(useLabelStore.getState().reason).toBe('වමනයට');

    useLabelStore.getState().toggleReason('කැස්සට');
    expect(useLabelStore.getState().reasons).toEqual(['වමනයට', 'කැස්සට']);
    expect(useLabelStore.getState().reason).toBe('වමනයට, කැස්සට');

    // Toggle 'වමනයට' off
    useLabelStore.getState().toggleReason('වමනයට');
    expect(useLabelStore.getState().reasons).toEqual(['කැස්සට']);
    expect(useLabelStore.getState().reason).toBe('කැස්සට');

    // Toggle 'කැස්සට' off
    useLabelStore.getState().toggleReason('කැස්සට');
    expect(useLabelStore.getState().reasons).toEqual([]);
    expect(useLabelStore.getState().reason).toBeNull();
  });

  it('clears all reasons when clearReasons is called', () => {
    useLabelStore.getState().toggleReason('සෙමට');
    useLabelStore.getState().toggleReason('කැස්සට');
    expect(useLabelStore.getState().reasons.length).toBe(2);

    useLabelStore.getState().clearReasons();
    expect(useLabelStore.getState().reasons).toEqual([]);
    expect(useLabelStore.getState().reason).toBeNull();
  });

  it('preserves multiple reasons per label across switching labels', () => {
    useLabelStore.getState().toggleReason('වමනයට');
    useLabelStore.getState().toggleReason('කැස්සට');

    // Add a second label
    useLabelStore.getState().addLabel();
    expect(useLabelStore.getState().reasons).toEqual([]);
    expect(useLabelStore.getState().reason).toBeNull();

    useLabelStore.getState().toggleReason('සෙමට');
    expect(useLabelStore.getState().reasons).toEqual(['සෙමට']);

    // Switch back to label 0
    useLabelStore.getState().selectLabel(0);
    expect(useLabelStore.getState().reasons).toEqual(['වමනයට', 'කැස්සට']);
    expect(useLabelStore.getState().reason).toBe('වමනයට, කැස්සට');

    // Switch back to label 1
    useLabelStore.getState().selectLabel(1);
    expect(useLabelStore.getState().reasons).toEqual(['සෙමට']);
    expect(useLabelStore.getState().reason).toBe('සෙමට');
  });
});

describe('labelStore Expiry Date Direct Logic', () => {
  beforeEach(() => {
    useLabelStore.getState().allClear();
  });

  it('populates expiry date from the selected product record when ADD EXP DATE is toggled without opening modal', () => {
    // Select a product whose API record includes an expiry date
    useLabelStore.getState().setProduct({ id: 'prod_lasix_40', name: "Lasix 40mg Tabs 500's", expiry_date: '8/31/2027' });

    // Toggle ADD EXP DATE
    useLabelStore.getState().toggleAdditionalInstruction('ADD EXP DATE');

    expect(useLabelStore.getState().expDateModalVisible).toBe(false);
    expect(useLabelStore.getState().expiryDate).toBe('8/31/2027');
    expect(useLabelStore.getState().additionalInstructions).toContain('ADD EXP DATE');

    // Toggle ADD EXP DATE off
    useLabelStore.getState().toggleAdditionalInstruction('ADD EXP DATE');
    expect(useLabelStore.getState().expiryDate).toBeNull();
    expect(useLabelStore.getState().additionalInstructions).not.toContain('ADD EXP DATE');
  });

  it('never invents an expiry date: asks the pharmacist when the product has no recorded expiry', () => {
    useLabelStore.setState({ expDateModalVisible: false });
    useLabelStore.getState().setProduct({ id: 'manual', name: 'Typed medicine name' });

    useLabelStore.getState().toggleAdditionalInstruction('ADD EXP DATE');

    expect(useLabelStore.getState().expDateModalVisible).toBe(true);
    expect(useLabelStore.getState().expiryDate).toBeNull();
    expect(useLabelStore.getState().additionalInstructions).not.toContain('ADD EXP DATE');
  });

  it('does not take an expiry from the old sample product list', () => {
    useLabelStore.setState({ expDateModalVisible: false });
    // Same id/name as a sample entry, but no expiry on the product record
    useLabelStore.getState().setProduct({ id: 'prod_lasix_40', name: "Lasix 40mg Tabs 500's" });

    useLabelStore.getState().toggleAdditionalInstruction('ADD EXP DATE');

    expect(useLabelStore.getState().expiryDate).toBeNull();
    expect(useLabelStore.getState().expDateModalVisible).toBe(true);
  });
});

