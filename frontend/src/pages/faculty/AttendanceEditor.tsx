import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { FacultyCourse} from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { History, X, Edit3, Search } from 'lucide-react';

export const AttendanceEditor: React.FC = () => {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<FacultyCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [records, setRecords] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Override modal
  const [activeRecord, setActiveRecord] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<'present' | 'absent'>('present');
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getFacultyCourses(user.id);
      setCourses(res);
      if (res.length > 0) {
        setSelectedCourseId(res[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your courses.');
    }
  }, [user]);

  const fetchCourseRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await api.getCourseAttendanceRecords(selectedCourseId));
    } catch (err) {
      setRecords([]);
      setError(err instanceof Error ? err.message : 'Unable to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);



  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseRecords();
    }
  }, [fetchCourseRecords, selectedCourseId]);



  const handleOpenOverride = (record: any) => {
    setActiveRecord(record);
    setNewStatus(record.status === 'present' ? 'absent' : 'present');
    setOverrideReason('');
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord || !overrideReason.trim()) return;

    setSubmitting(true);
    try {
      await api.overrideAttendance(activeRecord.id, newStatus, overrideReason.trim());
      setRecords((prev) =>
        prev.map((r) => (r.id === activeRecord.id ? { ...r, status: newStatus } : r))
      );
      setNotification(`Attendance record updated for ${activeRecord.full_name} (${newStatus.toUpperCase()}). Audit entry logged.`);
      setActiveRecord(null);
    } catch (err: any) {
      alert("Override error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.enrollment_no.includes(searchTerm)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-[#162456]" />
            Manual Attendance Overrides & Audit Trail
          </h1>
          <p className="text-xs text-slate-500">
            Every status alteration requires a logged justification for university audit compliance
          </p>
        </div>

        {/* Course Filter */}
        <div>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#162456] outline-none bg-white"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code}: {c.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span className="font-medium">{notification}</span>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Roster Table Card */}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student name or roll..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none bg-white"
            />
          </div>
          <span className="text-[11px] text-slate-400">
            All modifications write to immutable audit log
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3.5 px-6">Roll No</th>
                <th className="py-3.5 px-6">Student Name</th>
                <th className="py-3.5 px-6">Current Status</th>
                <th className="py-3.5 px-6">Last Marked At</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? <tr><td colSpan={5} className="p-6 text-center">Loading attendance records...</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="p-6 text-center">No attendance records found.</td></tr> : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-6 font-mono font-medium text-slate-600">
                    {r.enrollment_no}
                  </td>
                  <td className="py-3.5 px-6 font-semibold text-slate-900">
                    {r.full_name}
                  </td>
                  <td className="py-3.5 px-6">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3.5 px-6 text-slate-500 text-[11px]">
                        {new Date(r.marked_at).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      onClick={() => handleOpenOverride(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      {activeRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Manual Attendance Override
              </h3>
              <button onClick={() => setActiveRecord(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-700">
              <p><strong>Student:</strong> {activeRecord.full_name} ({activeRecord.enrollment_no})</p>
              <p><strong>Current Status:</strong> <span className="uppercase font-semibold">{activeRecord.status}</span></p>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Change Status To
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStatus('present')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      newStatus === 'present'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Mark Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('absent')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      newStatus === 'absent'
                        ? 'bg-red-50 text-red-800 border-red-300 ring-2 ring-red-500'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Mark Absent
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Student submitted Dean-approved medical certificate for session absence."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || overrideReason.trim().length < 3}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 rounded-lg transition"
                >
                  {submitting ? "Saving..." : "Save to Audit Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
