import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { DisputeReview } from '../../components/DisputeReview';
import { VerificationQueueItem } from '../../types';
import {
  CheckSquare,
  Check,
  X,
  ScanFace,
  UserCheck,
  ShieldCheck} from 'lucide-react';

export const VerificationQueue: React.FC = () => {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualItem, setManualItem] = useState<VerificationQueueItem | null>(null);
  const [candidates, setCandidates] = useState<{ student_id: string; full_name: string; enrollment_no: string }[]>([]);
  const [assignedStudent, setAssignedStudent] = useState('');

  const openManualAssignment = async (item: VerificationQueueItem) => {
    try {
      const result = await api.getSessionResults(item.session_id);
      setCandidates(result.records);
      setAssignedStudent('');
      setManualItem(item);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to load session roster.'); }
  };

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getVerificationQueue();
      setItems(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the verification queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);



  const handleResolve = async (queueId: string, action: 'confirm' | 'reject') => {
    setResolvingId(queueId);
    try {
      await api.resolveVerification(queueId, action);
      setFeedback(`Candidate ${action === 'confirm' ? 'Confirmed as Present' : 'Marked as Absent'}. Audit trail recorded.`);
      // Remove resolved item locally
      setItems((prev) => prev.filter((item) => item.id !== queueId));
      window.dispatchEvent(new Event('classsense-data-changed'));
    } catch (err: any) {
      alert("Resolution error: " + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {manualItem && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
        <form role="dialog" aria-modal="true" aria-labelledby="manual-assignment-title" className="bg-white p-6 rounded-2xl w-full max-w-md space-y-4" onSubmit={async event => {
          event.preventDefault(); setResolvingId(manualItem.id);
          try {
            await api.resolveVerification(manualItem.id, 'manual', assignedStudent);
            setItems(items => items.filter(item => item.id !== manualItem.id));
            setFeedback('Face manually assigned. Attendance changes saved to the audit log.');
            setManualItem(null);
            window.dispatchEvent(new Event('classsense-data-changed'));
          } catch (error) { setError(error instanceof Error ? error.message : 'Unable to assign student.'); setManualItem(null); }
          finally { setResolvingId(null); }
        }}>
          <h2 id="manual-assignment-title" className="font-bold">Assign detected face to a student</h2>
          <label className="block text-sm">Session roster
            <select required value={assignedStudent} onChange={event => setAssignedStudent(event.target.value)} className="w-full border p-2 rounded-lg mt-1">
              <option value="">Choose the correct student</option>
              {candidates.map(student => <option key={student.student_id} value={student.student_id}>{student.full_name} · {student.enrollment_no}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-500">The selected student will be marked present. A different original candidate will be marked absent.</p>
          <div className="flex justify-end gap-3">
            <button type="button" disabled={resolvingId !== null} onClick={() => setManualItem(null)}>Cancel</button>
            <button type="submit" disabled={!assignedStudent || resolvingId !== null} className="bg-[#162456] text-white rounded-lg px-4 py-2 disabled:opacity-50">Save assignment</button>
          </div>
        </form>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <DisputeReview />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#162456]" />
              Faculty Verification Queue
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {items.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Review uncertain classroom matches, single-frame sightings, and students who need a manual attendance check.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span className="font-medium">{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading verification items...
        </div>
      ) : !error && items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">Verification Queue Clear!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All classroom capture detections across your courses have been confirmed or finalized.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => {
            const similarityPct = (item.similarity_score * 100).toFixed(1);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                {/* Course Bar */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-blue-700 font-mono">{item.course_code}</span>
                    <span>{item.course_name}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(item.session_date).toLocaleDateString()}
                  </span>
                </div>

                {/* Main Comparison Section */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    {/* Detected Crop from Classroom Image */}
                    <div className="text-center space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Detected In Classroom
                      </span>
                      <div className="w-24 h-24 rounded-xl bg-slate-900 overflow-hidden border-2 border-amber-400 mx-auto flex items-center justify-center shadow-sm">
                        {item.face_crop_data ? (
                          <img src={item.face_crop_data} alt="Detected Crop" className="w-full h-full object-cover" />
                        ) : (
                          <ScanFace className="w-8 h-8 text-amber-300" />
                        )}
                      </div>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold inline-block">
                        Similarity: {similarityPct}%
                      </span>
                    </div>

                    {/* Candidate Enrolled Student Profile */}
                    <div className="text-center space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Candidate Enrolled Student
                      </span>
                      <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 mx-auto flex items-center justify-center shadow-sm">
                        {item.candidate_photo_url ? (
                          <img src={item.candidate_photo_url} alt={item.candidate_name} className="w-full h-full object-cover" />
                        ) : (
                          <UserCheck className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900 line-clamp-1">{item.candidate_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{item.candidate_enrollment_no}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                    <p>
                      <strong>Reason for Flag:</strong> {item.similarity_score === 0 ? 'A current face enrollment is missing. Please verify attendance manually.' : 'The match was uncertain or lacked enough independent high-confidence sightings. Please confirm student identity.'}
                    </p>
                  </div>
                </div>

                {/* 1-Click Fast Resolution Actions */}
                {item.face_crop_data && <button onClick={() => openManualAssignment(item)} className="text-xs font-semibold text-blue-700 px-4 py-2">Assign to a different student</button>}
                <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleResolve(item.id, 'reject')}
                    disabled={resolvingId === item.id}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Reject (Mark Absent)
                  </button>

                  <button
                    onClick={() => handleResolve(item.id, 'confirm')}
                    disabled={resolvingId === item.id}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Confirm Present
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
