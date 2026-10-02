import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { FacultyCourse } from '../../types';
interface Student { id: string; full_name: string; enrollment_no: string; face_enrolled: boolean }
interface Roster { class_configured: boolean; eligible_students: Student[]; enrolled_students: Student[] }

export function ClassRoster({ initialCourseId }: { initialCourseId?: string }) {
  const userId = useAuthStore(state => state.user?.id);
  const [courses, setCourses] = useState<FacultyCourse[]>([]);
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [roster, setRoster] = useState<Roster | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (!userId) return;
    api.getFacultyCourses(userId).then((data: FacultyCourse[]) => {
      if (!active) return;
      setCourses(data); setCourseId(current => data.some(course => course.id === current) ? current : data[0]?.id || '');
      if (!data.length) setLoading(false);
    }).catch(error => { if (active) { setError(error instanceof Error ? error.message : 'Unable to load courses.'); setLoading(false); } });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    let active = true;
    if (!courseId) return;
    setLoading(true); setRoster(null); setSelected(new Set()); setError(''); setMessage(''); setQuery('');
    api.getCourseRoster(courseId).then(data => { if (active) setRoster(data); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to load this class.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);
  async function enroll() {
    if (!selected.size) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await api.enrollCourseStudents(courseId, [...selected]);
      setMessage(result.message); setSelected(new Set()); setRoster(await api.getCourseRoster(courseId));
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to enroll students.'); }
    finally { setSaving(false); }
  }
  const course = courses.find(course => course.id === courseId);
  const visible = (roster?.eligible_students || []).filter(student => `${student.full_name} ${student.enrollment_no}`.toLowerCase().includes(query.toLowerCase().trim()));
  const allSelected = visible.length > 0 && visible.every(student => selected.has(student.id));
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <div className="p-6 max-w-6xl mx-auto space-y-5">
    <div><h1 className="text-xl font-bold">Class Roster & Enrollment</h1><p className="text-sm text-slate-600 mt-1">Enroll registered students belonging to your assigned class's branch, semester and section.</p></div>
    {error && <p role="alert" className="p-3 bg-red-50 rounded-lg text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="p-3 bg-green-50 rounded-lg text-sm text-green-800">{message}</p>}
    {!loading && !courses.length && !error && <p>No courses assigned. Ask your administrator to assign a course first.</p>}
    {courses.length > 0 && <label className="block text-sm font-semibold">Assigned class<select value={courseId} disabled={saving} onChange={event => setCourseId(event.target.value)} className="block w-full md:max-w-xl border rounded-lg bg-white p-3 mt-1">{courses.map(course => <option key={course.id} value={course.id}>{course.course_code} — {course.course_name} · {course.section || 'Class not configured'}</option>)}</select></label>}
    {course && <div className="p-4 bg-white border rounded-xl text-sm"><strong>{course.course_name}</strong><p className="text-slate-600 mt-1">{course.branch || 'Branch not set'} · {course.semester || 'Semester not set'} · {course.section || 'Section not set'} · Room {course.room}</p></div>}
    {loading && <p className="text-sm text-slate-500">Loading class roster...</p>}
    {roster && <>
      {!roster.class_configured && <p className="p-4 bg-amber-50 text-amber-900 rounded-lg text-sm">Ask your administrator to set branch, semester and section under Course Directory → Edit class details.</p>}
      {roster.class_configured && <section className="bg-white border rounded-xl p-4 space-y-4">
        <h2 className="font-bold">Eligible registered students ({roster.eligible_students.length})</h2><p className="text-xs text-slate-500">New registrations appear when class details match. Students can complete selfie enrollment after joining.</p>
        <label className="block text-sm">Search name or enrollment number<input value={query} onChange={event => setQuery(event.target.value)} className="block w-full md:max-w-md border rounded-lg p-2 mt-1" /></label>
        {visible.length ? <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="p-2"><input type="checkbox" aria-label="Select all students shown" checked={allSelected} disabled={saving} onChange={() => setSelected(current => { const next = new Set(current); visible.forEach(student => allSelected ? next.delete(student.id) : next.add(student.id)); return next; })} /></th><th className="p-2">Student</th><th className="p-2">Enrollment number</th><th className="p-2">Face template</th></tr></thead><tbody>{visible.map(student => <tr key={student.id} className="border-b"><td className="p-2"><input type="checkbox" aria-label={`Select ${student.full_name}`} checked={selected.has(student.id)} disabled={saving} onChange={() => toggle(student.id)} /></td><td className="p-2">{student.full_name}</td><td className="p-2">{student.enrollment_no}</td><td className="p-2">{student.face_enrolled ? 'Enrolled' : 'Selfie enrollment needed'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">{query ? 'No students match your search.' : 'No unenrolled students match this class. Students must register with the branch, semester and section shown above.'}</p>}
        <button disabled={saving || !selected.size} onClick={() => { void enroll(); }} className="px-4 py-2 rounded-lg bg-[#162456] text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Enrolling...' : `Enroll selected students (${selected.size})`}</button>
      </section>}
      <section className="bg-white border rounded-xl p-4 space-y-3"><h2 className="font-bold">Enrolled in this class ({roster.enrolled_students.length})</h2>{roster.enrolled_students.length ? <ul className="divide-y">{roster.enrolled_students.map(student => <li key={student.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{student.full_name} · {student.enrollment_no}</span><span className="text-slate-500">{student.face_enrolled ? 'Ready for face recognition' : 'Selfie enrollment needed'}</span></li>)}</ul> : <p className="text-sm text-slate-500">Enroll students above to build your attendance roster.</p>}</section>
    </>}
  </div>;
}
