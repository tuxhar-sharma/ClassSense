import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import type { DirectoryCourse, DirectoryPerson } from '../../types/timetable';

export function AdminDirectory({ kind }: { kind: 'faculty' | 'students' | 'courses' }) {
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [courses, setCourses] = useState<DirectoryCourse[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  async function deleteStudent(person: DirectoryPerson) {
    if (!window.confirm(`Permanently delete ${person.full_name}? This removes the login, face template, enrollments, timetable entries and linked attendance records across all courses. This cannot be undone.`)) return;
    setDeleting(true); setError('');
    try {
      await apiRequest(`/students/${person.id}`, { method: 'DELETE' });
      setPeople(current => current.filter(item => item.id !== person.id));
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to delete student.'); }
    finally { setDeleting(false); }
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    apiRequest<DirectoryCourse[] | DirectoryPerson[]>(`/admin/directory/${kind}`).then(data => {
      if (!active) return;
      if (kind === 'courses') setCourses(data as DirectoryCourse[]);
      else setPeople(data as DirectoryPerson[]);
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);
  const matches = (value: unknown) => JSON.stringify(value).toLowerCase().includes(search.toLowerCase());
  const courseTable = (rows: DirectoryCourse[]) => <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500 bg-slate-50"><tr><th className="p-3">Subject / code</th><th className="p-3">Class / batch</th><th className="p-3">Assigned faculty</th><th className="p-3">Room</th><th className="p-3">Enrolled</th></tr></thead><tbody>{rows.map(c => <tr key={c.id} className="border-t"><td className="p-3 font-semibold">{c.course_name}<p className="text-xs font-normal text-slate-500">{c.subject_code || c.course_code}</p></td><td className="p-3">{c.semester} · {c.section} {c.lab_group}</td><td className="p-3">{c.faculty_name}</td><td className="p-3">{c.room || 'Not specified'}</td><td className="p-3">{c.enrolled_count}</td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm text-slate-500">No courses assigned.</p>}</div>;
  const displayed = kind === 'courses' ? courses.filter(matches) : people.filter(matches);
  return <div className="p-6 max-w-7xl mx-auto space-y-5">
    <div><h1 className="text-xl font-bold">{kind === 'faculty' ? 'Faculty members & assigned courses' : kind === 'students' ? 'Registered students & course enrollments' : 'Active courses & faculty assignments'}</h1><p className="text-sm text-slate-500 mt-2">{displayed.length} results. Search by name, subject, semester, section or batch.</p></div>
    <input aria-label="Search directory" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search directory…" className="w-full max-w-xl border rounded-xl p-3 bg-white" />
    {loading && <p role="status">Loading directory…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {!loading && !error && (kind === 'courses' ? <section className="rounded-2xl border bg-white">{courseTable(courses.filter(matches))}</section> : people.filter(matches).map(person => <details key={person.id} className="rounded-2xl border bg-white p-4">
      <summary className="cursor-pointer"><span className="font-bold">{person.full_name}</span><span className="text-sm text-blue-700 ml-3">{person.courses.length} assigned courses</span><p className="text-xs text-slate-500 mt-1">{person.email} · {person.employee_id || person.enrollment_no}{kind === 'faculty' ? ` · ${person.verified ? 'Approved' : 'Pending approval'}` : ` · ${person.semester} · ${person.section} ${person.lab_group || ''}`}</p></summary>
      <div className="mt-4">{courseTable(person.courses)}</div>
      {kind === 'students' && <button disabled={deleting} onClick={() => { void deleteStudent(person); }} className="mt-3 text-sm text-red-700 border border-red-200 rounded-lg px-3 py-2 disabled:opacity-50">Delete student account</button>}
    </details>))}
    {!loading && !error && !displayed.length && <p className="text-sm text-slate-500">No matching records.</p>}
  </div>;
}
