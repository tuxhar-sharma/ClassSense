import { useEffect, useState } from 'react';
import { apiRequest, api } from '../api/client';
type Alert = { id: string; record_id: string; message: string; read: boolean; disputed: boolean };
export function AttendanceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await apiRequest<Alert[]>('/students/notifications');
        if (!active) return;
        setAlerts(data);
        for (const alert of data.filter(a => !a.read)) {
          const key = `classsense-alert:${alert.id}`;
          if ('Notification' in window && Notification.permission === 'granted' && !sessionStorage.getItem(key)) {
            new Notification('ClassSense attendance', { body: alert.message, tag: alert.id });
            sessionStorage.setItem(key, 'shown');
          }
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Unable to load alerts'); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const correct = async (alert: Alert) => {
    try {
      await api.raiseDispute(alert.record_id, 'I was present in class while the classroom photos were taken. Please review my attendance.');
      setAlerts(items => items.map(a => a.id === alert.id ? { ...a, disputed: true } : a));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to request correction'); }
  };
  return <section className="px-6 py-3 bg-amber-50 border-b border-amber-200" aria-label="Attendance alerts">
    <div className="flex gap-3 items-center"><strong>Attendance alerts</strong>
      {'Notification' in window && <button className="underline text-sm" onClick={async () => {
        try { const permission = await Notification.requestPermission(); if (permission !== 'granted') setError('Device alerts are blocked. Alerts will still appear here.'); }
        catch { setError('Device alerts are unavailable in this browser.'); }
      }}>Enable device alerts</button>}</div>
    {error && <p role="alert">{error}</p>}
    {alerts.filter(a => !a.read).map(alert => <div key={alert.id} className="py-2 text-sm flex flex-wrap gap-3">
      <span>{alert.message}</span><button className="underline" disabled={alert.disputed} onClick={() => void correct(alert)}>{alert.disputed ? 'Correction requested' : 'I was present ? request correction'}</button>
      <button className="underline" onClick={async () => {
        try { await apiRequest(`/students/notifications/${alert.id}/read`, { method: 'POST' }); setAlerts(items => items.map(a => a.id === alert.id ? { ...a, read: true } : a)); }
        catch (e) { setError(e instanceof Error ? e.message : 'Unable to dismiss'); }
      }}>Dismiss</button></div>)}
  </section>;
}
