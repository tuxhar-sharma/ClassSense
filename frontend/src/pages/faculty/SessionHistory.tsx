import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { FacultyCourse, SessionResults } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { CameraCaptureModal } from '../../components/CameraCaptureModal';

export function SessionHistory({ initialCourseId, initialSessionId, onNavigate }: { initialCourseId?: string; initialSessionId?: string; onNavigate: (page: string, params?: any) => void }) {
  const userId = useAuthStore(state => state.user?.id);
  const [courses, setCourses] = useState<FacultyCourse[]>([]);
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [results, setResults] = useState<SessionResults | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [version, setVersion] = useState('current');
  const [reason, setReason] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!userId) return;
    api.getFacultyCourses(userId).then((data: FacultyCourse[]) => { if (active) { setCourses(data); setCourseId(current => data.some(course => course.id === current) ? current : data[0]?.id || ''); if (!data.length) setLoading(false); } })
      .catch(error => { if (active) { setError(error.message); setLoading(false); } });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    let active = true;
    if (!courseId) return;
    setLoading(true); setResults(null); setSessions([]); setError('');
    api.getCourseSessions(courseId).then(data => { if (active) { setSessions(data); setSessionId(current => data.some(session => session.session_id === current) ? current : data[0]?.session_id || ''); } })
      .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);
  useEffect(() => {
    let active = true;
    setResults(null); setRevisions([]); setVersion('current'); setReason(''); setMessage('');
    if (!sessionId) return;
    Promise.all([api.getSessionResults(sessionId), api.getSessionRevisions(sessionId)]).then(([data, history]) => { if (active) { setResults(data); setRevisions(history); } })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [sessionId]);

  async function retake(images: string[]) {
    if (!results) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await api.retakeSession(sessionId, images, reason.trim(), results.revision);
      const [data, history, list] = await Promise.all([api.getSessionResults(sessionId), api.getSessionRevisions(sessionId), api.getCourseSessions(courseId)]);
      setResults(data); setRevisions(history); setSessions(list); setVersion('current'); setReason(''); setMessage(response.message);
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch (error) { setError(error instanceof Error ? error.message : 'Attendance retake failed. Previous results are preserved.'); }
    finally { setBusy(false); }
  }
  const archived = version === 'current' ? null : revisions.find(revision => String(revision.revision) === version);
  const records = archived ? archived.snapshot.records : results?.records || [];
  return <div className="p-6 max-w-7xl mx-auto space-y-5">
    <div><h1 className="text-xl font-bold">Session History & Retakes</h1><p className="text-sm text-slate-600 mt-1">Reopen saved attendance, check the student list, and retake the same class session when capture results need correction.</p></div>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</p>}{message && <p role="status" className="p-3 bg-green-50 text-green-800 rounded-lg">{message}</p>}
    {courses.length > 0 && <label className="block text-sm font-semibold">Course<select value={courseId} disabled={busy || captureOpen} onChange={event => { setSessionId(''); setCourseId(event.target.value); }} className="block w-full md:max-w-lg border rounded-lg p-2 mt-1">{courses.map(course => <option key={course.id} value={course.id}>{course.course_code} — {course.course_name}</option>)}</select></label>}
    {loading && <p>Loading sessions...</p>}
    {!loading && !courses.length && !error && <p>No courses assigned yet.</p>}
    {!loading && courseId && !sessions.length && !error && <p>No sessions saved for this course yet. Use Classroom AI Capture to take attendance.</p>}
    {sessions.length > 0 && <label className="block text-sm font-semibold">Saved session<select value={sessionId} disabled={busy || captureOpen} onChange={event => setSessionId(event.target.value)} className="block w-full md:max-w-2xl border rounded-lg p-2 mt-1">{sessions.map(session => <option key={session.session_id} value={session.session_id}>{new Date(session.session_date).toLocaleString()} · {session.session_type} · {session.status} · P {session.present_count} / A {session.absent_count} / Review {session.review_count} · v{session.revision}</option>)}</select></label>}
    {sessionId && !results && !error && <p>Loading student attendance...</p>}
    {results && <section className="bg-white border rounded-xl p-5 space-y-4">
      <h2 className="font-bold">{results.course_name} · {new Date(results.session_date).toLocaleString()}</h2>
      <p className="text-sm text-slate-600">{results.session_type} · {results.total_enrolled} students · {results.image_count} images · Current version {results.revision}</p>
      {revisions.length > 0 && <label className="block text-sm">Result version<select value={version} onChange={event => setVersion(event.target.value)} disabled={busy || captureOpen} className="block border rounded-lg p-2 mt-1"><option value="current">Current results (v{results.revision})</option>{revisions.map(revision => <option key={revision.revision} value={revision.revision}>Previous results (v{revision.revision})</option>)}</select></label>}
      {archived && <p className="text-sm text-amber-800">Saved before retake on {new Date(archived.replaced_at).toLocaleString()}. Reason: {archived.reason}</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="p-2">Student</th><th className="p-2">Enrollment number</th><th className="p-2">Attendance</th><th className="p-2">Similarity</th><th className="p-2">Sightings</th></tr></thead><tbody>{records.map((record: any) => <tr key={record.student_id} className="border-b"><td className="p-2">{record.full_name}</td><td className="p-2">{record.enrollment_no}</td><td className="p-2"><StatusBadge status={record.status} /></td><td className="p-2">{record.confidence_score.toFixed(3)}</td><td className="p-2">{record.appearances}</td></tr>)}</tbody></table></div>
      {results.status === 'completed' && version === 'current' && <form onSubmit={event => { event.preventDefault(); setCaptureOpen(true); }} className="border-t pt-4 space-y-3">
        <h3 className="font-bold">Retake attendance for this session</h3><p className="text-sm text-slate-600">Upload or capture 3–4 new images. Current results, including manual corrections, will be replaced. Earlier results and audit history are preserved. This remains one class in attendance totals and uses the original student roster.</p>
        <label className="block text-sm font-medium">Reason for retake<input required minLength={3} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} placeholder="e.g. First photos missed the back row" className="block w-full border rounded-lg p-2 mt-1" /></label>
        <button disabled={busy || reason.trim().length < 3} className="bg-[#162456] text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Processing new attendance...' : 'Retake attendance'}</button>
        <button type="button" disabled={busy} onClick={() => onNavigate('overrides')} className="text-blue-700 text-sm ml-4">Correct individual records</button>
      </form>}
      {results.review_count > 0 && <button disabled={busy} onClick={() => onNavigate('queue')} className="text-blue-700 text-sm">Review uncertain matches</button>}
      {results.status !== 'completed' && <p className="text-sm text-slate-600">This session has not saved attendance yet.</p>}
    </section>}
    <CameraCaptureModal isOpen={captureOpen} onClose={() => setCaptureOpen(false)} onConfirmImages={images => { void retake(images); }} />
  </div>;
}
