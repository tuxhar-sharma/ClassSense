import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import type { DepartmentTimetable, StudentProfile, TimetableItem } from '../../types';
import { Calendar, Clock, MapPin, Users, BookOpen } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const campusDay = () => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
const timeLabel = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

function DaySchedule({ entries, showLunch }: { entries: TimetableItem[]; showLunch: boolean }) {
  const slots = new Map<string, { start: string; end: string; period: string; entries: TimetableItem[] }>();
  for (const entry of entries) {
    const key = entry.slot_key || `${entry.start_time}-${entry.end_time}`;
    const slot = slots.get(key) || { start: entry.start_time, end: entry.end_time, period: entry.period || '', entries: [] };
    slot.entries.push(entry);
    slots.set(key, slot);
  }
  if (showLunch) slots.set('lunch', { start: '12:50', end: '13:40', period: 'Lunch', entries: [] });
  return <div className="space-y-3">
    {[...slots.values()].sort((a, b) => a.start.localeCompare(b.start)).map(slot => (
      <div key={`${slot.start}-${slot.end}`} className={`rounded-xl border p-3 ${slot.period === 'Lunch' ? 'border-dashed border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-slate-600 mb-2">
          <Clock className="w-3.5 h-3.5" /><span>{timeLabel(slot.start)} – {timeLabel(slot.end)}</span>
          {slot.period && <span className="text-slate-400">{slot.period === 'Lunch' ? 'Lunch break' : `Period ${slot.period}`}</span>}
        </div>
        {slot.period === 'Lunch' ? <p className="text-xs text-slate-500">End time inferred from period V.</p> : slot.entries.map((entry, index) => <div key={entry.id} className={index ? 'mt-3 border-t border-dashed border-slate-200 pt-3' : ''}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${entry.session_type === 'Lab' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-800'}`}>{entry.session_type}</span>
            {entry.lab_group && <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">{entry.lab_group}</span>}
            {entry.parallel_slot && <span className="text-[10px] text-slate-500">Parallel option</span>}
          </div>
          <h3 className="text-sm font-bold text-slate-900">{entry.course_name} {entry.notation}</h3>
          {entry.course_code && <p className="text-xs text-blue-700 mt-0.5">{entry.course_code}</p>}
          <p className="flex items-start gap-1.5 text-xs text-slate-600 mt-2"><Users className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{entry.faculty_name || 'Faculty not specified in source'}</span></p>
          <p className="flex items-start gap-1.5 text-xs text-slate-600 mt-1"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{entry.room ? `Room ${entry.room}` : 'Room not specified in source'}{entry.room_source === 'class header' && <span className="text-slate-400"> (class home room)</span>}</span></p>
          {entry.source_note && <p className="text-xs text-amber-800 mt-2">{entry.source_note}</p>}
        </div>)}
      </div>
    ))}
    {!entries.length && <p className="text-sm text-slate-500 py-4">No sessions listed for this day and batch. Check the source notes for any allocation ambiguity.</p>}
  </div>;
}

export function StudentTimetable() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [published, setPublished] = useState<DepartmentTimetable | null>(null);
  const [entries, setEntries] = useState<TimetableItem[]>([]);
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [group, setGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [day, setDay] = useState(() => DAYS.includes(campusDay()) ? campusDay() : 'Monday');
  const [view, setView] = useState<'day' | 'week'>('day');
  const isIT = ['it', 'informationtechnology'].includes((profile?.branch || '').toLowerCase().replace(/[^a-z]/g, ''));

  const fetchTimetable = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const student: StudentProfile = await api.getStudentProfile(user.id);
      const [department, timetable] = await Promise.all([api.getDepartmentTimetable(student.id), api.getStudentTimetable(student.id)]);
      setProfile(student); setSemester(student.semester); setSection(student.section);
      setGroup(student.lab_group || ''); setPublished(department); setEntries(timetable);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load timetable.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void fetchTimetable(); }, [fetchTimetable]);

  const saveClass = async () => {
    if (!profile) return;
    setSaving(true); setError(''); setSaved('');
    try {
      await api.updateStudentProfile(profile.id, { semester, section, lab_group: group });
      await fetchTimetable();
      setSaved('Class details saved. Your timetable now follows this semester, section and lab batch.');
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save class details.'); }
    finally { setSaving(false); }
  };

  const days = [...DAYS, ...(entries.some(e => e.day_of_week === 'Saturday') ? ['Saturday'] : []), ...(entries.some(e => e.day_of_week === 'Sunday') ? ['Sunday'] : [])];
  const mainEntries = published?.available ? entries.filter(e => e.source === 'department') : entries;
  const additionalEntries = published?.available ? entries.filter(e => e.source !== 'department') : [];
  return <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto space-y-6">
    <div className="rounded-2xl bg-[#162456] p-6 text-white">
      <h1 className="text-xl font-bold flex items-center gap-2"><Calendar className="w-5 h-5" />Your class timetable</h1>
      <p className="text-sm text-blue-100 mt-2">{published?.available ? `${published.class_label} · ${published.source.academic_year}` : 'Your weekly classes, labs and faculty'}</p>
      {published?.available && <p className="text-xs text-blue-200 mt-2">Effective {published.source.effective_from} · All times India Standard Time</p>}
    </div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 text-sm">{error} <button onClick={() => void fetchTimetable()} className="underline">Retry</button></div>}
    {saved && <p role="status" className="text-sm text-green-800">{saved}</p>}
    {loading && <p role="status" className="text-sm text-slate-500">Loading timetable…</p>}
    {isIT && <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="font-bold text-slate-900">Your IT class & lab batch</h2>
      <p className="text-sm text-slate-600">Use your official section and batch. This updates your student class details. Numeric section labels are not assumed to mean A, B or C.</p>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-700">Semester<select value={semester} onChange={e => { setSemester(e.target.value); setSaved(''); }} className="block rounded-lg border p-2 mt-1">{['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">Official section<select value={section} onChange={e => { setSection(e.target.value); setSaved(''); }} className="block rounded-lg border p-2 mt-1">{!['A', 'B', 'C'].includes(section) && <option value={section}>{section || 'Choose section'}</option>}{['A', 'B', 'C'].map(s => <option key={s} value={s}>IT {s}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">Assigned lab batch<select value={group} onChange={e => { setGroup(e.target.value); setSaved(''); }} className="block rounded-lg border p-2 mt-1"><option value="">Not selected — show both</option><option>G1</option><option>G2</option></select></label>
        <button disabled={saving || loading} onClick={() => void saveClass()} className="rounded-lg bg-[#162456] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save class details'}</button>
      </div>
      {published && !published.available && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{published.message}</p>}
    </section>}
    {!loading && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Timetable day">{days.map(d => <button key={d} aria-pressed={day === d && view === 'day'} onClick={() => { setDay(d); setView('day'); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${day === d && view === 'day' ? 'bg-[#162456] text-white' : 'bg-white border text-slate-600'}`}>{d}{campusDay() === d ? ' · Today' : ''}</button>)}</div>
        <button aria-pressed={view === 'week'} onClick={() => setView(view === 'week' ? 'day' : 'week')} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">{view === 'week' ? 'Day view' : 'Full week'}</button>
      </div>
      {published?.available && !DAYS.includes(campusDay()) && !mainEntries.some(entry => entry.day_of_week === campusDay()) && <p className="text-sm text-slate-500">No classes listed today. Showing {view === 'week' ? 'the weekly schedule' : day}.</p>}
      {published?.warnings.length ? <details className="rounded-xl border border-amber-200 bg-amber-50 p-4" open><summary className="cursor-pointer text-sm font-semibold text-amber-900">Batch, parallel options & source notes</summary><ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-amber-900">{published.warnings.map(note => <li key={note}>{note}</li>)}</ul></details> : null}
      <div className={view === 'week' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4' : 'max-w-3xl'}>
        {(view === 'week' ? days : [day]).map(d => <section key={d} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><h2 className="font-bold text-slate-900 mb-3">{d}</h2><DaySchedule entries={mainEntries.filter(e => e.day_of_week === d)} showLunch={!!published?.available && DAYS.includes(d)} /></section>)}
      </div>
      {additionalEntries.length > 0 && <section className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="font-bold">Additional enrolled-course schedule</h2><p className="text-xs text-slate-500">These entries were configured through course management and are shown separately from the published department sheet.</p>{days.filter(d => additionalEntries.some(e => e.day_of_week === d)).map(d => <div key={d}><h3 className="font-semibold mb-2">{d}</h3><DaySchedule entries={additionalEntries.filter(e => e.day_of_week === d)} showLunch={false} /></div>)}</section>}
      {published?.available && <>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4" />Subject & faculty directory</h2>
          <p className="text-xs text-slate-500 mt-2">Names and abbreviations as supplied. Entries without a weekly slot remain listed here.</p>
          <div className="overflow-x-auto mt-4"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="p-2">Subject</th><th className="p-2">Code</th><th className="p-2">Faculty</th><th className="p-2">Schedule</th></tr></thead><tbody>{published.faculty_assignments.map((f, index) => <tr key={index} className="border-t"><td className="p-2 font-semibold">{f.subject} {f.lab_group}</td><td className="p-2 whitespace-nowrap">{f.code || 'Not printed'}</td><td className="p-2">{f.faculty_name || 'Not specified in source'}</td><td className="p-2 text-xs">{f.scheduled ? 'Weekly grid' : 'No weekly slot printed'}</td></tr>)}</tbody></table></div>
        </section>
        <details className="rounded-2xl border bg-white p-5 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Source & period timings</summary>
          <p className="mt-3">{published.source.title} · Issued {published.source.issued_on} · {published.source.institute}</p>
          <p className="mt-2">Source: {published.source.document}. Printed header: {published.printed_semester_label}. Signed: {published.source.signed_by}. Issuer: {published.source.issuer}.</p>
          <div className="flex flex-wrap gap-2 mt-3">{published.periods.map(p => <span key={p.period} className="rounded bg-slate-100 p-2">{p.period}: {timeLabel(p.start_time)}–{timeLabel(p.end_time)}</span>)}</div>
          <ul className="list-disc pl-4 mt-3 space-y-1">{published.source.notes.map(note => <li key={note}>{note}</li>)}</ul>
        </details>
      </>}
    </>}
  </div>;
}
