import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../api/client';
import { PasswordInput } from '../../components/PasswordInput';

export function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (password !== confirm) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await apiRequest<{message: string}>('/auth/change-password', { method: 'POST', body: JSON.stringify({current_password: current, password}) });
      setMessage(result.message); setCurrent(''); setPassword(''); setConfirm('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to change password.'); }
    finally { setBusy(false); }
  }
  const style = 'block w-full border rounded-lg p-3 mt-1';
  return <form onSubmit={submit} className="max-w-lg mx-auto p-6 space-y-5">
    <h1 className="text-xl font-bold">Change password</h1>
    <p className="text-sm text-slate-600">Replace your initial student password with a private password.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-green-700">{message}</p>}
    <label className="block text-sm">Current password<PasswordInput required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={style} /></label>
    <label className="block text-sm">New password<PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={style} /><span className="text-xs text-slate-500">At least 8 characters; maximum 72 UTF-8 bytes.</span></label>
    <label className="block text-sm">Confirm new password<PasswordInput required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={style} /></label>
    <button disabled={busy} className="bg-[#162456] text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Saving...' : 'Change password'}</button>
  </form>;
}
