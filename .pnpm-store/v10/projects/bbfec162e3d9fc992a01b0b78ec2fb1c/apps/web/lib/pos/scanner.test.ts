import { describe, expect, it } from 'vitest';
import { createScanGate, DUPLICATE_SCAN_WINDOW_MS } from './scanner';

describe('scan gate', () => {
  it('processes one scan once even when the scanner sends two Enter events (CR+LF)', () => {
    const gate = createScanGate();
    expect(gate.accept('4791000123', 1000)).toBe(true);
    expect(gate.accept('4791000123', 1003)).toBe(false);
  });

  it('ignores auto-repeated Enter and empty input', () => {
    const gate = createScanGate();
    expect(gate.accept('4791000123', 1000, true)).toBe(false);
    expect(gate.accept('   ', 1000)).toBe(false);
  });

  it('counts deliberate repeat scans of the same pack', () => {
    const gate = createScanGate();
    expect(gate.accept('4791000123', 1000)).toBe(true);
    expect(gate.accept('4791000123', 1000 + DUPLICATE_SCAN_WINDOW_MS)).toBe(true);
    expect(gate.accept('4791000123', 1400)).toBe(true);
  });

  it('accepts different codes in rapid succession', () => {
    const gate = createScanGate();
    expect(gate.accept('4791000123', 1000)).toBe(true);
    expect(gate.accept('4792000456', 1001)).toBe(true);
    expect(gate.accept('4791000123', 1002)).toBe(true);
  });
});
