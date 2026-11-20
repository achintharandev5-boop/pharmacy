/**
 * Keyboard-wedge barcode scanners type the code and press Enter. Some send CR+LF, which arrives
 * as two Enter events for one scan, and a stuck key auto-repeats. The gate accepts one event per
 * scan and drops an identical code that follows within a few milliseconds. A person scanning the
 * same pack again takes far longer than the window, so deliberate repeat scans are all counted.
 */
export const DUPLICATE_SCAN_WINDOW_MS = 60;

export interface ScanGate {
  /** True when this Enter should be processed as a new scan. */
  accept(code: string, now: number, isRepeat?: boolean): boolean;
}

export function createScanGate(windowMs = DUPLICATE_SCAN_WINDOW_MS): ScanGate {
  let last: { code: string; at: number } | null = null;
  return {
    accept(code, now, isRepeat = false) {
      const trimmed = code.trim();
      if (!trimmed || isRepeat) return false;
      if (last && last.code === trimmed && now - last.at < windowMs) return false;
      last = { code: trimmed, at: now };
      return true;
    },
  };
}
