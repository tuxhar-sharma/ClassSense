import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { FacultyCourse, FacultyAnalytics as AnalyticsType } from '../../types';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  AlertTriangle} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export const FacultyAnalytics: React.FC = () => {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<FacultyCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getFacultyCourses(user.id);
      setCourses(res);
      if (res.length > 0) {
        setSelectedCourseId(res[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your courses.');
      setLoading(false);
    }
  }, [user]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFacultyAnalytics(user?.id || '', selectedCourseId);
      setAnalytics(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCourseId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);



  useEffect(() => {
    if (selectedCourseId) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, selectedCourseId]);



  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!selectedCourseId) return;
    try {
      await api.downloadReport(selectedCourseId, format);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Report download failed.');
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && courses.length === 0 && <p className="text-sm text-slate-500">No courses assigned yet.</p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#162456]" />
            Faculty Attendance Analytics & Reports
          </h1>
          <p className="text-xs text-slate-500">
            Attendance trends, proactive at-risk identification, and official report exports
          </p>
        </div>

        {/* Course Selector & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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

          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Export Excel (.xlsx)
          </button>

          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-800 bg-red-100 hover:bg-red-200 transition shadow-sm"
          >
            <FileText className="w-4 h-4 text-red-700" />
            Official PDF (.pdf)
          </button>
        </div>
      </div>

      {loading || !analytics ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading course analytics...
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Average Attendance Rate
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {analytics.average_attendance}%
                </span>
                <span className="text-xs text-slate-500 font-medium">overall batch</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Target: &ge; 75% department threshold
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Sessions Held
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {analytics.total_sessions_conducted}
                </span>
                <span className="text-xs text-slate-500 font-medium">lectures / labs</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Captured via multi-image AI pipeline
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                At-Risk Students (&lt;75%)
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-red-600">
                  {analytics.at_risk_students.length}
                </span>
                <span className="text-xs text-red-600 font-medium">students in critical bracket</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Automated projection for recovery
              </p>
            </div>
          </div>

          {/* Attendance Trend Chart */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Attendance Rate Trends</h3>
                <p className="text-xs text-slate-500">Session-by-session classroom attendance percentage</p>
              </div>
            </div>

            <div className="h-64 w-full">
              {analytics.trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#162456', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                      formatter={(val: any) => [`${val}%`, 'Attendance Rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="attendance_rate"
                      stroke="#162456"
                      strokeWidth={3}
                      dot={{ fill: '#991b1b', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No session trend data available yet
                </div>
              )}
            </div>
          </div>

          {/* Proactive At-Risk Students Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-red-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="font-bold text-sm text-red-900">
                  Proactive At-Risk Students (&lt;75% Cutoff)
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-red-700">
                {analytics.at_risk_students.length} student(s) requiring intervention
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3.5 px-6">Roll No</th>
                    <th className="py-3.5 px-6">Student Name</th>
                    <th className="py-3.5 px-6">Attended / Total</th>
                    <th className="py-3.5 px-6">Attendance %</th>
                    <th className="py-3.5 px-6">Classes Needed To Recover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {analytics.at_risk_students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No students currently below 75% cutoff for this course. Excellent attendance!
                      </td>
                    </tr>
                  ) : (
                    analytics.at_risk_students.map((st) => (
                      <tr key={st.student_id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-6 font-mono font-medium text-slate-700">
                          {st.enrollment_no}
                        </td>
                        <td className="py-3.5 px-6 font-bold text-slate-900">
                          {st.full_name}
                        </td>
                        <td className="py-3.5 px-6 text-slate-600">
                          {st.attended} / {st.total}
                        </td>
                        <td className="py-3.5 px-6">
                          <span className="px-2 py-0.5 rounded font-bold text-red-700 bg-red-100 text-xs">
                            {st.percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-red-600">
                          Must attend next <strong>{st.classes_needed}</strong> classes consecutively
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
