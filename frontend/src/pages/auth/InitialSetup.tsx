import { useState } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export function InitialSetup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await api.setupAdmin({ full_name: name.trim(), email: email.trim(), password });
      login(result.access_token, { id: result.user_id, email: email.trim().toLowerCase(), full_name: result.full_name, role: 'admin' });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to complete setup.');
    } finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <main className="w-full max-w-md bg-white rounded-2xl border shadow-lg p-6 space-y-5">
      <div><p className="text-sm font-bold text-[#162456]">ClassSense</p><h1 className="text-xl font-bold mt-2">Set up your administrator</h1>
        <p className="text-sm text-slate-600 mt-2">Create your own account to manage faculty approval, courses, rosters, and timetables. This setup is available only once, from localhost.</p></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Full name<input required minLength={2} maxLength={255} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
        <label className="block text-sm font-medium">Administrator email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
        <label className="block text-sm font-medium">Password<input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="block w-full border rounded-lg p-2 mt-1" /><span className="text-xs text-slate-500">At least 8 characters. Keep this password for future sign-ins.</span></label>
        <label className="block text-sm font-medium">Confirm password<input required type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
        <button disabled={saving} className="w-full rounded-lg bg-[#162456] text-white font-semibold p-3 disabled:opacity-50">{saving ? 'Creating administrator...' : 'Create administrator and continue'}</button>
      </form>
    </main>
  </div>;
}
