import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import type { DepartmentTimetable } from '../types';
type Notice = {id:string;title:string;message:string;read:boolean;created_at:string};
export function TimetableNotifications({onNavigate,role}:{onNavigate:(page:string)=>void;role:string}) {
  const [items,setItems] = useState<Notice[]>([]);
  const [error,setError] = useState('');
  const [open,setOpen] = useState(false);
  const [preview,setPreview] = useState<DepartmentTimetable|null>(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{apiRequest<Notice[]>('/timetable-notifications').then(rows=>{if(active){setItems(rows);setError('');}}).catch(error=>{if(active)setError(error.message);});};
    refresh();const timer=window.setInterval(refresh,15000);window.addEventListener('classsense-data-changed',refresh);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('classsense-data-changed',refresh);};
  },[]);
  const read=async(id:string)=>{await apiRequest(`/timetable-notifications/${id}/read`,{method:'POST'});setItems(rows=>rows.map(n=>n.id===id?{...n,read:true}:n));};
  const view=async(item:Notice)=>{try{setPreview(await apiRequest<DepartmentTimetable>(`/timetable-notifications/${item.id}/timetable`));await read(item.id);}catch(error){setError(error instanceof Error?error.message:'Unable to open timetable.');}};
  return <section className="border-b bg-blue-50 px-4 py-2 text-sm" aria-label="Timetable notifications">
    <div className="flex gap-4 flex-wrap"><button onClick={()=>setOpen(!open)} aria-expanded={open} className="font-semibold text-blue-900">Timetable notifications {items.filter(n=>!n.read).length>0?`(${items.filter(n=>!n.read).length} unread)`:''}</button><button className="underline text-blue-700" onClick={()=>onNavigate(role==='faculty'?'faculty-timetable':'timetable')}>Open my timetable</button></div>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {open&&<div className="mt-3 max-h-80 overflow-auto space-y-2">{!items.length&&<p className="text-slate-500">No timetable updates yet.</p>}{items.map(item=><article key={item.id} className={`rounded-lg border p-3 ${item.read?'bg-white':'bg-blue-100'}`}><h3 className="font-semibold">{item.title}</h3><p className="text-xs text-slate-600 mt-1">{item.message}</p><div className="flex gap-4 mt-2"><button className="text-xs underline text-blue-800" onClick={()=>void view(item)}>View published version</button>{!item.read&&<button className="text-xs underline" onClick={()=>void read(item.id).catch(error=>setError(error.message))}>Mark as read</button>}</div></article>)}</div>}
    {preview&&<div role="dialog" aria-modal="true" aria-label="Published timetable" className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-5 max-w-5xl w-full max-h-[85vh] overflow-auto"><div className="flex justify-between gap-4"><div><h2 className="font-bold">{preview.source.title} · {preview.class_label}</h2><p className="text-xs text-slate-500">Effective {preview.source.effective_from} · All times IST</p></div><button onClick={()=>setPreview(null)} className="border rounded px-3 py-1">Close</button></div><div className="overflow-x-auto mt-4"><table className="w-full text-xs text-left"><thead><tr>{['Day / time','Subject / batch','Faculty','Room'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{preview.entries.map(row=><tr key={row.id} className="border-t"><td className="p-2">{row.day_of_week} {row.start_time}–{row.end_time}</td><td className="p-2">{row.course_name} {row.lab_group}</td><td className="p-2">{row.faculty_name||'Not specified'}</td><td className="p-2">{row.room||'Not specified'}</td></tr>)}</tbody></table></div></div></div>}
  </section>;
}
