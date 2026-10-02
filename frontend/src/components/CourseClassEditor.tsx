import { useState } from 'react';
import { api } from '../api/client';
import { ClassFields } from './ClassFields';
export function CourseClassEditor({ course, onClose, onSaved }: { course: any; onClose: () => void; onSaved: () => void }) {
  const [details, setDetails] = useState({ branch: course.branch || '', semester: course.semester || '', section: course.section || '' });
  const [room, setRoom] = useState(course.room || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.updateCourse(course.id, { ...course, ...details, section: details.section.trim(), room: room.trim() }); onSaved(); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save class details.'); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="class-editor-title" className="bg-white rounded-xl max-w-md w-full p-6 space-y-4"><h2 id="class-editor-title" className="font-bold">Class details — {course.course_code}</h2><p className="text-xs text-slate-600">Assigned faculty can enroll students from this branch, semester and section.</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><ClassFields value={details} onChange={setDetails} /><label className="block text-xs font-semibold">Classroom<input required maxLength={50} value={room} onChange={event => setRoom(event.target.value)} className="w-full border rounded-lg p-2 mt-1" /></label></fieldset><div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy} className="bg-[#162456] text-white rounded-lg px-4 py-2">{busy ? 'Saving...' : 'Save class details'}</button></div></form></section></div>;
}
