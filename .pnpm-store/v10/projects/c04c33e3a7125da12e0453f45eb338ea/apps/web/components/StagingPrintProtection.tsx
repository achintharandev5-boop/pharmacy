import { syntheticStaging } from '@/lib/stagingPolicy';

/** Browser File > Print must not bypass the application's disabled print buttons. */
export function StagingPrintProtection() {
  if (!syntheticStaging()) return null;
  return <>
    <style>{'@media print { body > * { display: none !important; } body > #staging-print-blocker { display: block !important; color: black !important; font: bold 16pt sans-serif !important; } }'}</style>
    <div id="staging-print-blocker" style={{ display: 'none' }}>SYNTHETIC STAGING — PRINTING DISABLED — NOT FOR CLINICAL USE</div>
  </>;
}
