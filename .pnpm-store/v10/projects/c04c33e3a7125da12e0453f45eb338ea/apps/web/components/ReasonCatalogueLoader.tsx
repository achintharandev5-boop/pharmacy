'use client';
import { useEffect, useState } from 'react';
import { getReasons } from '@/app/actions/reasons';
import { useLabelStore } from '@/store/labelStore';
import { uiTestEnabled } from '@/lib/uiTestMode';
import { readLocalReasons } from '@/lib/localReasons';
export function ReasonCatalogueLoader() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    useLabelStore.getState().setReasonCatalogue(null);
    async function load() {
      try {
        const result = uiTestEnabled() ? { ok: true as const, data: readLocalReasons().filter(r => r.is_active) } : await getReasons();
        if (!live) return;
        if (!result.ok) { setError(result.error); return; }
        const texts = result.data.map(r => r.text);
        useLabelStore.getState().setReasonCatalogue(texts);
        if (!useLabelStore.getState().reasonCatalogue) setError('Invalid reason catalogue response.');
      } catch { if (live) setError('Could not load reasons. Please retry.'); }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; };
  }, [attempt]);
  return <>{loading && <p role="status">Loading reasons…</p>}{error && <p role="alert">{error} <button onClick={() => { setLoading(true); setError(''); setAttempt(n => n + 1); }}>Retry reasons</button></p>}</>;
}

