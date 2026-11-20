'use client';
import { useEffect, useState } from 'react';
import { getReasons, createReason, editReason, deactivateReason } from '@/app/actions/reasons';
import type { CatalogueReason } from '@/lib/reasonCatalogue';
import { uiTestEnabled } from '@/lib/uiTestMode';
import { readLocalReasons, writeLocalReasons } from '@/lib/localReasons';
import { Alert, Badge, Button, Card, CardBody, EmptyState, FormField, Input, PageBody, PageHeader, SkeletonRows } from '@/components/ui';
import { CheckCircle2, CircleOff, Pencil, Plus, RefreshCw } from 'lucide-react';

export default function EditReasonsPage() {
  const [rows, setRows] = useState<CatalogueReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const local = uiTestEnabled();
  function load() {
    const request = local ? Promise.resolve().then(() => ({ ok: true as const, data: readLocalReasons() })) : getReasons(true);
    return request.then(result => {
      if (result.ok) { setRows(result.data); setLoaded(true); } else { setError(result.error); setLoaded(false); }
    }, () => { setError('Could not load reasons.'); setLoaded(false); }).finally(() => setLoading(false));
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function mutate(remove?: string) {
    if (!remove && (!text.trim() || text.length > 200 || /[\r\n]/.test(text))) { setError('Enter a nonblank reason of at most 200 characters on one line.'); return; }
    setBusy(true); setError('');
    try {
      if (local) {
        if (!remove && rows.some(r => r.id !== editing && r.text === text)) { setError('That exact reason already exists.'); return; }
        const next = remove ? rows.map(r => r.id === remove ? { ...r, is_active: false } : r)
          : editing ? rows.map(r => r.id === editing ? { ...r, text } : r)
          : [...rows, { id: crypto.randomUUID(), text, is_active: true }];
        writeLocalReasons(next); setRows(next);
      } else {
        const result = remove ? await deactivateReason(remove) : editing ? await editReason(editing, text) : await createReason(text);
        if (!result.ok) { setError(result.error); return; }
        await load();
      }
      setText(''); setEditing(null);
    } catch { setError('The operation could not be confirmed. Reload before retrying.'); }
    finally { setBusy(false); }
  }
  return <PageBody>
    <PageHeader title="Edit Reasons" description="Manage the exact wording available to pharmacists when recording a reason." actions={<Button variant="outline" icon={RefreshCw} disabled={busy || loading} onClick={() => { setLoading(true); setError(''); void load(); }}>Reload reasons</Button>} />
    {local && <Alert tone="info">UI testing mode: temporary entries in this tab only. Not saved to the database.</Alert>}
    {error && <Alert tone="danger">{error}</Alert>}
    <Card><CardBody className="space-y-5">
      <div><h2 className="text-base font-semibold text-fg">Reason catalogue</h2><p className="mt-1 text-sm text-muted">Keep wording clear and consistent. Existing historical entries are retained.</p></div>
      {loading && <SkeletonRows rows={3} label="Loading reasons" />}
      {!loading && loaded && <>
        <form onSubmit={e => { e.preventDefault(); void mutate(); }} className="flex flex-col items-end gap-3 sm:flex-row">
          <FormField label="Exact reason wording" hint="Up to 200 characters on one line." className="w-full flex-1">{field => <Input {...field} value={text} maxLength={200} onChange={e => setText(e.target.value)} disabled={busy} />}</FormField>
          <div className="flex w-full gap-2 sm:w-auto"><Button type="submit" className="flex-1 sm:flex-none" variant="primary" icon={editing ? CheckCircle2 : Plus} disabled={busy || loading} loading={busy}>{editing ? 'Save changes' : 'Add reason'}</Button>
            {editing && <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(null); setText(''); }}>Cancel edit</Button>}</div>
        </form>
        {!rows.length && <EmptyState title="No reasons configured" description="An administrator can add exact wording here." />}
        {!!rows.length && <ul aria-label="Configured reasons" className="divide-y divide-border rounded-ui border border-border">
          {rows.map(r => <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-fg">{r.text}</span><Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
            <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" icon={Pencil} disabled={busy || loading} onClick={() => { setEditing(r.id); setText(r.text); }}>Edit</Button>
              {r.is_active && <Button size="sm" variant="ghost" icon={CircleOff} disabled={busy || loading} onClick={() => void mutate(r.id)}>Deactivate</Button>}</div>
          </li>)}
        </ul>}
      </>}
    </CardBody></Card>
  </PageBody>;
}
