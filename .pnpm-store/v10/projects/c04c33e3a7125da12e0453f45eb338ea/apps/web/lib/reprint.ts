/**
 * Admin-side "Reprint" only calls a logging endpoint; it does not send anything to a printer.
 * Using it would record reprints that never happened, so it stays disabled until real
 * printing is wired up.
 */
export const REPRINT_UNAVAILABLE_REASON =
  'Reprint from the admin panel is not available yet: it would log a reprint without printing a label. Use the label workstation to print.';
