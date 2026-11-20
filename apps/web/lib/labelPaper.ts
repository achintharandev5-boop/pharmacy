export type LabelPaper = { widthMm: number; heightMm: number };
export const DEFAULT_LABEL_PAPER: LabelPaper = { widthMm: 70, heightMm: 50 };

/** Null settings retain the installed 70 × 50 mm stock. Reject invalid CSS dimensions. */
export function labelPaperFrom(settings?: { label_width_mm?: number | null; label_height_mm?: number | null } | null): LabelPaper {
  const widthMm = settings?.label_width_mm;
  const heightMm = settings?.label_height_mm;
  return typeof widthMm === 'number' && Number.isFinite(widthMm) && widthMm > 0 &&
    typeof heightMm === 'number' && Number.isFinite(heightMm) && heightMm > 0
    ? { widthMm, heightMm } : DEFAULT_LABEL_PAPER;
}

