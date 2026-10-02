import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Dispute {
  id: string;
  student_name: string;
  enrollment_no: string;
  course_name: string;
  session_date: string;
  reason: string;
}

export function DisputeReview() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    api.getPendingDisputes().then(data => { if (active) setItems(data); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function resolve(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    setError('');
    try {
      await api.resolveDispute(id, action, (reasons[id] || '').trim());
      setItems(items => items.filter(item => item.id !== id));
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not resolve dispute.');
    } finally {
      setBusy(null);
    }
  }

  return <section className="space-y-4" aria-labelledby="dispute-title">
    <h2 id="dispute-title" className="text-lg font-bold">Student absence disputes ({items.length})</h2>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading ? <p className="text-sm text-slate-500">Loading disputes...</p> : items.length === 0 ?
      <p className="text-sm text-slate-500">No pending absence disputes.</p> :
      items.map(item => <article key={item.id} className="bg-white p-5 border rounded-xl space-y-3">
        <h3 className="font-semibold">{item.student_name} · {item.enrollment_no}</h3>
        <p className="text-sm text-slate-600">{item.course_name} · {new Date(item.session_date).toLocaleDateString()}</p>
        <p className="text-sm whitespace-pre-wrap">{item.reason}</p>
        <label className="block text-sm">Resolution reason
          <textarea value={reasons[item.id] || ''} onChange={event => setReasons(previous => ({ ...previous, [item.id]: event.target.value }))}
            rows={2} className="block w-full border rounded-lg p-2 mt-1" />
        </label>
        <div className="flex gap-3">
          <button disabled={busy !== null || (reasons[item.id] || '').trim().length < 3} onClick={() => resolve(item.id, 'approve')}
            className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">Approve · Mark present</button>
          <button disabled={busy !== null || (reasons[item.id] || '').trim().length < 3} onClick={() => resolve(item.id, 'reject')}
            className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm disabled:opacity-50">Reject dispute</button>
        </div>
      </article>)}
  </section>;
}
