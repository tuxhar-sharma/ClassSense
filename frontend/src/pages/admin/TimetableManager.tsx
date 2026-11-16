import { useEffect, useState } from 'react';
import { apiRequest, timetableTemplateUrl } from '../../api/client';
import type { PublishedSlot, TimetableDraft } from '../../types/timetable';

const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TYPES = ['Lecture', 'Lab', 'Tutorial', 'Library', 'Enrichment', 'Project', 'PDP', 'Activity', 'Bridge course'];
const blankRow = (): PublishedSlot => ({day_of_week:'Monday', start_time:'09:30', end_time:'10:20', course_name:'', course_code:'', faculty_ids:[], room:'', session_type:'Lecture', lab_group:'', source_note:'', period:'', notation:''});
const initialDraft: TimetableDraft = {title:'IT department timetable', branch:'Information Technology', semester:'3rd', section:'A', effective_from:'2026-08-03', entries:[], subjects:[], notes:[], expected_revision:0, source_document:'Created in ClassSense'};

export function TimetableManager() {
  const [draft, setDraft] = useState<TimetableDraft>(initialDraft);
  const [faculty, setFaculty] = useState<{id:string; full_name:string}[]>([]);
  const [semester, setSemester] = useState('3rd');
  const [section, setSection] = useState('A');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<{id:string; semester:string; section:string; revision:number; effective_from:string; title:string}[]>([]);
  useEffect(() => {
    apiRequest<{id:string; full_name:string}[]>('/admin/faculty').then(setFaculty).catch(error => setError(error.message));
    apiRequest<typeof history>('/admin/timetables').then(setHistory).catch(error => setError(error.message));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setMessage('');
    apiRequest<TimetableDraft>(`/admin/timetables/class/${semester}/${section}`).then(data => { if (active) setDraft(data); })
      .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [semester, section]);
  const change = (index:number, value:Partial<PublishedSlot>) => setDraft(d => ({...d, entries:d.entries.map((row,i) => i === index ? {...row,...value} : row)}));
  const download = (name:string, value:string, type:string) => {
    const url = URL.createObjectURL(new Blob([value], {type})); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
  };
  const template = async () => {
    try {
      const response = await fetch(timetableTemplateUrl, {headers:{Authorization:`Bearer ${localStorage.getItem('classsense_token')}`}});
      if (!response.ok) throw new Error('Unable to download template.');
      download('ClassSense_Timetable_Template.csv', await response.text(), 'text/csv');
    } catch(error) { setError(error instanceof Error ? error.message : 'Template download failed.'); }
  };
  const upload = async (file:File) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData(); body.append('file',file); body.append('metadata',JSON.stringify(draft));
      const preview = await apiRequest<TimetableDraft>('/admin/timetables/preview',{method:'POST',body});
      if (preview.semester !== semester || preview.section !== section) throw new Error('Select the matching semester and section before importing this file.');
      setDraft(preview); setMessage('File imported for review. Check all rows and faculty before publishing. No notifications have been sent yet.');
    } catch(error) { setError(error instanceof Error ? error.message : 'Unable to import timetable.'); }
    finally {setBusy(false);}
  };
  const publish = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest<{message:string; revision:number; notifications:number; scheduled_for_future:boolean}>('/admin/timetables/publish',{method:'POST',body:JSON.stringify(draft)});
      setDraft(d => ({...d, expected_revision:result.revision}));
      setMessage(`Published version ${result.revision}. ${result.notifications} notifications saved.${result.scheduled_for_future ? ' Course assignments activate on the effective date.' : ' Faculty course assignments are updated.'}`);
      setHistory(await apiRequest<typeof history>('/admin/timetables'));
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch(error) { setError(error instanceof Error ? error.message : 'Publication failed.'); }
    finally {setBusy(false);}
  };
  const disabled = loading || busy;
  return <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
    <div><h1 className="text-xl font-bold">Timetable manager</h1><p className="text-sm text-slate-500 mt-2">Create or upload a complete class timetable, review faculty assignments, then publish a new version.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4">{error}</p>}{message && <p role="status" className="rounded-xl bg-green-50 text-green-800 p-4">{message}</p>}
    <section className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="flex flex-wrap gap-4 items-end"><label>Semester<select disabled={busy} value={semester} onChange={e => setSemester(e.target.value)} className="block border rounded-lg p-2">{SEMESTERS.map(s => <option key={s}>{s}</option>)}</select></label><label>Section<select disabled={busy} value={section} onChange={e => setSection(e.target.value)} className="block border rounded-lg p-2">{['A','B','C'].map(s => <option key={s}>{s}</option>)}</select></label><span className="text-sm text-slate-500">Latest version: {draft.expected_revision || 'Not published'}</span></div>
      {loading && <p>Loading class timetable…</p>}
      <div className="grid md:grid-cols-2 gap-4"><label className="text-sm">Timetable title<input disabled={disabled} value={draft.title} onChange={e => setDraft(d=>({...d,title:e.target.value}))} className="block border rounded-lg p-2 w-full" /></label><label className="text-sm">Effective from (India time)<input disabled={disabled} type="date" value={draft.effective_from} onChange={e => setDraft(d=>({...d,effective_from:e.target.value}))} className="block border rounded-lg p-2 w-full" /></label></div>
      <div className="flex flex-wrap gap-3"><button disabled={disabled} onClick={() => setDraft(d=>({...d,entries:[blankRow()],subjects:[],notes:[],source_document:'Created in ClassSense'}))} className="border rounded-lg px-4 py-2">Create new timetable</button><button disabled={disabled} onClick={() => void template()} className="border rounded-lg px-4 py-2">Download CSV template</button><label className="border rounded-lg px-4 py-2 cursor-pointer">Upload CSV / JSON<input disabled={disabled} type="file" accept=".csv,.json" className="block text-xs mt-1" onChange={e => {const file=e.target.files?.[0]; if(file) void upload(file); e.target.value='';}} /></label><button disabled={disabled} onClick={() => download(`IT-${semester}-${section}-timetable.json`,JSON.stringify(draft,null,2),'application/json')} className="border rounded-lg px-4 py-2">Export editable JSON</button></div>
      <p className="text-xs text-slate-500">CSV uses one row per subject/batch/slot. Use faculty IDs from the directory below; separate co-teachers with a semicolon. Parallel options use separate rows at the same time. Uploads are previews until you publish. Scanned PDFs/photos need transcription into this editor.</p>
      <details><summary className="cursor-pointer text-sm text-blue-700">Faculty IDs for CSV imports</summary><div className="max-h-60 overflow-auto mt-2 text-xs space-y-1">{faculty.map(f => <p key={f.id}>{f.full_name}: <code>{f.id}</code></p>)}</div></details>
    </section>
    <section className="rounded-2xl border bg-white p-4 space-y-4">
      <h2 className="font-bold">Review schedule · {draft.entries.length} rows</h2>
      <div className="overflow-auto max-h-[650px]"><table className="text-xs w-full min-w-[1500px] text-left"><thead className="bg-slate-50 sticky top-0"><tr>{['Day','Start','End','Subject','Code','Faculty (select co-teachers)','Room','Type','Batch','Source note',''].map((h,i)=><th className="p-2" key={i}>{h}</th>)}</tr></thead><tbody>{draft.entries.map((row,index)=><tr key={index} className="border-t align-top">
        <td className="p-1"><select disabled={disabled} value={row.day_of_week} onChange={e=>change(index,{day_of_week:e.target.value})} aria-label={`Day row ${index+1}`} className="border rounded p-2">{DAYS.map(d=><option key={d}>{d}</option>)}</select></td>
        <td className="p-1"><input disabled={disabled} type="time" value={row.start_time} onChange={e=>change(index,{start_time:e.target.value,period:''})} aria-label={`Start row ${index+1}`} className="border rounded p-2" /></td>
        <td className="p-1"><input disabled={disabled} type="time" value={row.end_time} onChange={e=>change(index,{end_time:e.target.value,period:''})} aria-label={`End row ${index+1}`} className="border rounded p-2" /></td>
        <td className="p-1"><input disabled={disabled} value={row.course_name} onChange={e=>change(index,{course_name:e.target.value})} aria-label={`Subject row ${index+1}`} className="border rounded p-2 w-32" /></td>
        <td className="p-1"><input disabled={disabled} value={row.course_code} onChange={e=>change(index,{course_code:e.target.value})} aria-label={`Code row ${index+1}`} className="border rounded p-2 w-28" /></td>
        <td className="p-1"><select multiple disabled={disabled} value={row.faculty_ids} onChange={e=>change(index,{faculty_ids:Array.from(e.target.selectedOptions,option=>option.value)})} aria-label={`Faculty row ${index+1}`} className="border rounded p-2 w-56 h-20">{faculty.map(f=><option key={f.id} value={f.id}>{f.full_name}</option>)}</select><p className="text-[10px] text-slate-500">Ctrl/Cmd-click for multiple faculty</p></td>
        <td className="p-1"><input disabled={disabled} value={row.room} onChange={e=>change(index,{room:e.target.value})} aria-label={`Room row ${index+1}`} className="border rounded p-2 w-24" /></td>
        <td className="p-1"><select disabled={disabled} value={row.session_type} onChange={e=>change(index,{session_type:e.target.value})} aria-label={`Type row ${index+1}`} className="border rounded p-2">{TYPES.map(t=><option key={t}>{t}</option>)}</select></td>
        <td className="p-1"><select disabled={disabled} value={row.lab_group} onChange={e=>change(index,{lab_group:e.target.value})} aria-label={`Batch row ${index+1}`} className="border rounded p-2"><option value="">All</option><option>G1</option><option>G2</option></select></td>
        <td className="p-1"><input disabled={disabled} value={row.source_note} onChange={e=>change(index,{source_note:e.target.value})} aria-label={`Note row ${index+1}`} className="border rounded p-2 w-40" /></td>
        <td className="p-1"><button disabled={disabled} onClick={()=>setDraft(d=>({...d,entries:d.entries.filter((_,i)=>i!==index)}))} aria-label={`Remove row ${index+1}`} className="p-2 text-red-700">Remove</button></td>
      </tr>)}</tbody></table></div>
      <button disabled={disabled} onClick={()=>setDraft(d=>({...d,entries:[...d.entries,blankRow()]}))} className="border rounded-lg px-4 py-2">Add period / parallel option</button>
      {draft.subjects.length > 0 && <details><summary className="text-sm cursor-pointer">{draft.subjects.length} faculty assignments without weekly slots</summary>{draft.subjects.map((s,i)=><div key={i} className="flex gap-3 py-2 items-center"><span className="text-sm">{s.course_name} · {s.course_code}</span><select multiple disabled={disabled} value={s.faculty_ids} onChange={e=>{const ids=Array.from(e.target.selectedOptions,o=>o.value);setDraft(d=>({...d,subjects:d.subjects.map((s,j)=>j===i?{...s,faculty_ids:ids}:s)}));}} className="border rounded p-2 h-20 text-xs">{faculty.map(f=><option key={f.id} value={f.id}>{f.full_name}</option>)}</select></div>)}</details>}
      <label className="block text-sm">Publication notes (one per line)<textarea disabled={disabled} value={draft.notes.join('\n')} onChange={e=>setDraft(d=>({...d,notes:e.target.value.split('\n')}))} className="block border rounded-lg p-2 w-full mt-1" rows={3} /></label>
      <p className="text-sm text-slate-600">Publishing replaces this class's schedule from the effective date, updates faculty course assignments, and notifies its registered students and the previous/new faculty. Existing attendance history is retained.</p>
      <button disabled={disabled || !draft.entries.length || draft.semester!==semester || draft.section!==section} onClick={()=>void publish()} className="bg-[#162456] text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-50">{busy?'Working…':'Publish timetable & notify'}</button>
    </section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold mb-3">Publication history · IT {section}, {semester}</h2>{history.filter(p=>p.semester===semester&&p.section===section).map(p=><p key={p.id} className="py-2 text-sm border-t">Version {p.revision} · effective {p.effective_from} · {p.title}</p>)}{!history.some(p=>p.semester===semester&&p.section===section)&&<p className="text-sm text-slate-500">No published versions yet.</p>}</section>
  </div>;
}
