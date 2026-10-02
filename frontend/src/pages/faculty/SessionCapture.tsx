import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { FacultyCourse, SessionResults } from '../../types';
import { CameraCaptureModal } from '../../components/CameraCaptureModal';
import { StatusBadge } from '../../components/StatusBadge';
import {
  Camera,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Sparkles} from 'lucide-react';

interface SessionCaptureProps {
  onNavigate: (page: string, params?: any) => void;
  initialCourseId?: string;
}

export const SessionCapture: React.FC<SessionCaptureProps> = ({ onNavigate, initialCourseId }) => {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<FacultyCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [sessionType, setSessionType] = useState('Lecture');
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getFacultyCourses(user.id);
      setCourses(res);
      if (res.length > 0) {
        setSelectedCourseId(current => current || res[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your courses.');
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);



  const handleImagesCaptured = async (images: string[]) => {
    if (!selectedCourseId) {
      alert("Please select a course first.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Initializing session...");

    try {
      // 1. Start Session
      const session = await api.startSession(selectedCourseId, sessionType);
      
      setStatusMessage(`Analyzing ${images.length} frames (ArcFace 512-d embeddings + multi-image aggregation)...`);

      // 2. Send multi-image burst to AI pipeline
      await api.captureSession(session.session_id, images);

      // 3. Fetch aggregated results
      const results = await api.getSessionResults(session.session_id);
      setSessionResults(results);
    } catch (err: any) {
      alert("Session processing error: " + err.message);
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#162456]" />
            Classroom AI Attendance Session
          </h1>
          <p className="text-xs text-slate-500">
            Multi-Image Capture (3–4 frames) • ArcFace 512-d Embedding • Confidence-Aware Auto-Marking
          </p>
        </div>
      </div>

      {/* Session Configuration Card */}
      {!sessionResults && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#162456] outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code}: {c.course_name} ({c.enrolled_count} enrolled)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Session Type</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#162456] outline-none"
              >
                <option value="Lecture">Lecture</option>
                <option value="Lab">Lab Practical</option>
                <option value="Tutorial">Tutorial</option>
              </select>
            </div>
          </div>

          {/* Launch Multi-Image Trigger */}
          <div className="p-8 border-2 border-dashed border-blue-200 bg-blue-50/40 rounded-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#162456] text-white flex items-center justify-center mx-auto shadow-md">
              <Camera className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-900">
                Capture Classroom Frontal Images
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Take 3 to 4 photos across the room or upload images. The AI detects enrolled student faces, combines sightings, and routes uncertain matches for your review.
              </p>
            </div>

            <button
              onClick={() => setIsCaptureModalOpen(true)}
              disabled={isProcessing || !selectedCourseId}
              className="px-8 py-3 rounded-xl bg-[#991b1b] hover:bg-[#7f1d1d] text-white text-xs font-bold transition shadow-md flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {statusMessage || "Processing AI Pipeline..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Launch Multi-Image Camera
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Results View */}
      {sessionResults && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Session Completed
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{sessionResults.course_name}</h2>
                <p className="text-xs text-slate-500">
                  {sessionResults.session_type} • {new Date(sessionResults.session_date).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => onNavigate('session-history', { courseId: selectedCourseId, sessionId: sessionResults.session_id })} className="px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50">Saved session & retake attendance</button>
                {sessionResults.review_count > 0 && (
                  <button
                    onClick={() => onNavigate('queue')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Review {sessionResults.review_count} Flagged Cases
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setSessionResults(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  New Session
                </button>
              </div>
            </div>

            {/* Quick Counters */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] text-slate-500">Enrolled</p>
                <p className="text-xl font-bold text-slate-900">{sessionResults.total_enrolled}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] text-emerald-700 font-semibold">Auto-Marked Present</p>
                <p className="text-xl font-bold text-emerald-800">{sessionResults.present_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-[11px] text-amber-700 font-semibold">Flagged for Review</p>
                <p className="text-xl font-bold text-amber-800">{sessionResults.review_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-[11px] text-red-700 font-semibold">Absent</p>
                <p className="text-xl font-bold text-red-800">{sessionResults.absent_count}</p>
              </div>
            </div>
          </div>

          {/* Roster Match List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">Classroom Recognition Breakdown</h3>
              <span className="text-[11px] text-slate-400">
                Threshold: High &ge; 65% (multi-frame) • Review 45-64%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-6">Student</th>
                    <th className="py-3 px-6">Roll No</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Match Confidence</th>
                    <th className="py-3 px-6">Aggregation Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sessionResults.records.map((r) => (
                    <tr key={r.student_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        {r.full_name}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-600">
                        {r.enrollment_no}
                      </td>
                      <td className="py-3.5 px-6">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-700">
                        {r.confidence_score > 0 ? `${(r.confidence_score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 text-[11px]">
                        {r.status === 'present' ? (
                          <span className="text-emerald-700 font-medium">Auto-confirmed by multi-image consistency</span>
                        ) : r.status === 'pending_review' ? (
                          <span className="text-amber-700 font-medium">Routed to verification queue for approval</span>
                        ) : (
                          <span className="text-slate-400">Not detected in classroom capture</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <CameraCaptureModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onConfirmImages={handleImagesCaptured}
        targetCount={3}
      />
    </div>
  );
};
