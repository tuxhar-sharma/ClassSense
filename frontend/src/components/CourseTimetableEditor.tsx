import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Slot {
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  session_type: string;
}

export function CourseTimetableEditor({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.getCourseTimetable(courseId).then(slots => { if (active) setSlots(slots); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  function update(index: number, field: keyof Slot, value: string) {
    setSlots(slots => slots.map((slot, current) => current === index ? { ...slot, [field]: value } : slot));
  }

  return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="timetable-editor-title" className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try { await api.saveCourseTimetable(courseId, slots); onClose(); }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not save timetable.'); }
      finally { setBusy(false); }
    }}>
      <h2 id="timetable-editor-title" className="text-lg font-bold">Course weekly timetable</h2>
      <p className="text-sm text-slate-500">Applies to every student enrolled in this course.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loading ? <p>Loading timetable...</p> : slots.map((slot, index) => <div key={index} className="grid grid-cols-2 sm:grid-cols-6 gap-2 border rounded-lg p-3">
        <label className="text-xs">Day<select className="block w-full border p-2 rounded mt-1" value={slot.day_of_week} onChange={event => update(index, 'day_of_week', event.target.value)}>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => <option key={day}>{day}</option>)}
        </select></label>
        <label className="text-xs">Start<input type="time" required className="block w-full border p-2 rounded mt-1" value={slot.start_time} onChange={event => update(index, 'start_time', event.target.value)} /></label>
        <label className="text-xs">End<input type="time" required className="block w-full border p-2 rounded mt-1" value={slot.end_time} onChange={event => update(index, 'end_time', event.target.value)} /></label>
        <label className="text-xs">Room<input required className="block w-full border p-2 rounded mt-1" value={slot.room} onChange={event => update(index, 'room', event.target.value)} /></label>
        <label className="text-xs">Type<select className="block w-full border p-2 rounded mt-1" value={slot.session_type} onChange={event => update(index, 'session_type', event.target.value)}>{['Lecture', 'Lab', 'Tutorial'].map(type => <option key={type}>{type}</option>)}</select></label>
        <button type="button" className="text-red-700 text-xs" onClick={() => setSlots(slots => slots.filter((_, current) => current !== index))}>Remove slot</button>
      </div>)}
      <button type="button" disabled={loading || slots.length >= 20} className="text-sm text-blue-700" onClick={() => setSlots(slots => [...slots, { day_of_week: 'Monday', start_time: '09:00', end_time: '10:00', room: 'LH-204', session_type: 'Lecture' }])}>+ Add session</button>
      <div className="flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={loading || busy} className="bg-[#162456] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{busy ? 'Saving...' : 'Save timetable'}</button>
      </div>
    </form>
  </div>;
}
