import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { PublishedSlot } from '../../types/timetable';
type Slot = PublishedSlot & {id:string; semester:string; section:string; effective_from:string; faculty_name:string};
export function FacultyTimetable() {
  const {user} = useAuthStore();
  const [data,setData] = useState<{entries:Slot[];upcoming:Slot[]}>({entries:[],upcoming:[]});
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  useEffect(()=>{if(!user)return;let active=true;apiRequest<typeof data>(`/faculty/${user.id}/timetable`).then(value=>{if(active)setData(value);}).catch(error=>{if(active)setError(error.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[user]);
  const table = (rows:Slot[]) => <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Day / time (IST)','Class / batch','Subject','Room','Effective from'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{[...rows].sort((a,b)=>['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(a.day_of_week)-['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(b.day_of_week)||a.start_time.localeCompare(b.start_time)).map(row=><tr className="border-t" key={row.id}><td className="p-3">{row.day_of_week}<p className="text-xs text-slate-500">{row.start_time}–{row.end_time}</p></td><td className="p-3">IT {row.section} · {row.semester} {row.lab_group}</td><td className="p-3 font-semibold">{row.course_name}<p className="text-xs text-slate-500">{row.course_code} · {row.session_type}</p><p className="text-xs text-amber-800">{row.source_note}</p></td><td className="p-3">{row.room||'Not specified'}</td><td className="p-3">{row.effective_from}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-4 text-sm text-slate-500">No published teaching slots. Subjects without weekly periods remain in your assigned-course list.</p>}</div>;
  return <div className="p-6 max-w-7xl mx-auto space-y-5"><h1 className="text-xl font-bold">My teaching timetable</h1><p className="text-sm text-slate-500">Your assigned lectures, labs, class sections and batches. All times use India Standard Time.</p>{loading&&<p>Loading timetable…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}<section className="rounded-2xl border bg-white p-4"><h2 className="font-bold mb-3">Current schedule</h2>{table(data.entries)}</section>{data.upcoming.length>0&&<section className="rounded-2xl border bg-blue-50 p-4"><h2 className="font-bold mb-3">Upcoming published schedules</h2>{table(data.upcoming)}</section>}</div>;
}
