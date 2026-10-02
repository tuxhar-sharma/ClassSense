import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { SessionHistoryItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Clock, CheckCircle2, MessageSquare, Send, X} from 'lucide-react';

export const StudentHistory: React.FC = () => {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<SessionHistoryItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const profile = await api.getStudentProfile(user.id);
      const res = await api.getStudentSessions(profile.id);
      setSessions(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance history.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);



  const handleOpenDispute = (record: SessionHistoryItem) => {
    setSelectedRecord(record);
    setDisputeReason('');
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !disputeReason.trim()) return;

    setSubmittingDispute(true);
    try {
      await api.raiseDispute(selectedRecord.record_id, disputeReason.trim());
      setNotification(`Dispute raised for ${selectedRecord.course_name}. Routed to faculty queue for resolution.`);
      setSelectedRecord(null);
      fetchSessions();
    } catch (err: any) {
      alert("Error raising dispute: " + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#162456]" />
            Attendance History & Records
          </h1>
          <p className="text-xs text-slate-500">
            Transparent session log captured by multi-image AI. Disputed absences are flagged to faculty.
          </p>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sessions Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Course</th>
                <th className="py-3.5 px-6">Session Date</th>
                <th className="py-3.5 px-6">Type</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">AI Confidence</th>
                <th className="py-3.5 px-6 text-right">Dispute / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading attendance records...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No attendance records found yet.
                  </td>
                </tr>
              ) : (
                sessions.map((rec) => {
                  const dateStr = new Date(rec.session_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={rec.record_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        <div>
                          <span>{rec.course_name}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">{rec.course_code}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {dateStr}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {rec.session_type}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={rec.status} />
                      </td>
                      <td className="py-4 px-6">
                        {rec.confidence_score > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">
                              {(rec.confidence_score * 100).toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {rec.auto_marked ? '(Auto-marked)' : '(Faculty verified)'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {rec.dispute_status ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            Dispute: {rec.dispute_status.toUpperCase()}
                          </span>
                        ) : rec.status === 'absent' ? (
                          <button
                            onClick={() => handleOpenDispute(rec)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Raise Dispute
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No action</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Contest Attendance Absence
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-700">
                <p><strong>Course:</strong> {selectedRecord.course_name} ({selectedRecord.course_code})</p>
                <p><strong>Date:</strong> {new Date(selectedRecord.session_date).toLocaleDateString()}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Dispute (Mandatory justification for Faculty Review)
                </label>
                <textarea
                  rows={3}
                  required
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g. I was sitting in Row 3 near the window, but the camera capture may have suffered glare/occlusion."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute || !disputeReason.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 rounded-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingDispute ? "Submitting..." : "Submit to Faculty Queue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
