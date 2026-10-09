import React from 'react';
import { Info } from 'lucide-react';

/**
 * Temporary notice for pages backed by API endpoints that currently substitute sample values
 * when real counts are zero or a query fails (admin dashboard summary/activity/top-products and
 * inventory summary). Remove once the backend fallbacks are fixed.
 */
export default function UnverifiedDataNotice() {
  return (
    <div role="note" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2">
      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        <strong className="font-bold">Figures not verified.</strong> The server currently substitutes sample values for some
        summary figures when real data is missing. Do not rely on the totals and charts on this page until this is fixed.
      </span>
    </div>
  );
}
