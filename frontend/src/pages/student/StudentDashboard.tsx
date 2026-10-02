import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { StudentOverallAttendance, TimetableItem } from '../../types';
import { AttendanceGauge } from '../../components/AttendanceGauge';
import {
  ShieldAlert,
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigate: (page: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const [data, setData] = useState<StudentOverallAttendance | null>(null);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // First get student profile ID using user ID
      const profile = await api.getStudentProfile(user.id);
      const att = await api.getStudentAttendance(profile.id);
      const tt = await api.getStudentTimetable(profile.id);
      setData(att);
      setTimetable(tt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);



  if (!loading && error) return <div className="p-6 space-y-3"><p role="alert" className="text-red-700">{error}</p><button onClick={fetchDashboardData} className="text-blue-700">Retry</button></div>;
  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-[3px] border-[#162456] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Loading your attendance records...</p>
        </div>
      </div>
    );
  }

  // Calculate total safe bunks and total recovery classes across courses
  const totalSafeBunks = data.courses.reduce((acc, c) => acc + c.safe_bunk_count, 0);
  const totalRecoveryNeeded = data.courses.reduce((acc, c) => acc + c.classes_needed_to_recover, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#162456] to-[#243a85] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full text-blue-200">
            Student Attendance Portal
          </span>
          <h1 className="text-2xl font-bold mt-2">Welcome back, {user?.full_name}!</h1>
          <p className="text-xs text-blue-200 mt-1">
            Your courses, attendance, and weekly schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('history')}
            className="px-4 py-2 rounded-xl bg-white text-[#162456] hover:bg-slate-100 text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            Session History
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {data.total_conducted === 0 && <p className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">No attendance has been recorded yet. Your administrator must enroll you in a course, and your faculty must complete a session.</p>}
      {/* Top Row: Overall Gauge & Key Predictive Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Attendance Gauge */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Overall Semester Attendance
          </h3>
          {data.total_conducted > 0 ? <AttendanceGauge percentage={data.overall_percentage} size={180} /> : <div className="h-[180px] flex flex-col items-center justify-center"><span className="text-3xl font-bold text-slate-700">—</span><span className="text-sm text-slate-500">Awaiting first session</span></div>}
          <div className="grid grid-cols-2 gap-4 w-full mt-4 pt-4 border-t border-slate-100 text-center">
            <div>
              <p className="text-[11px] text-slate-500">Attended</p>
              <p className="text-base font-bold text-slate-800">{data.total_attended} classes</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Conducted</p>
              <p className="text-base font-bold text-slate-800">{data.total_conducted} classes</p>
            </div>
          </div>
        </div>

        {/* Persona 1 Need: Safe Bunk Buffer */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Safe Bunk Buffer
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-emerald-700">{totalSafeBunks}</span>
              <span className="text-xs text-slate-500 ml-2 font-medium">classes available</span>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Based on your current attendance rate, you can miss up to <strong>{totalSafeBunks} classes</strong> aggregate across subjects while safely remaining above the mandatory <strong>75% IPU exam eligibility cutoff</strong>.
            </p>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-[11px] text-emerald-800 font-medium">
              You are currently in the safe eligibility bracket.
            </p>
          </div>
        </div>

        {/* Persona 4 Need: At-Risk & Recovery Projection */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Eligibility Protection
              </span>
              <div className={`p-2 rounded-xl ${data.at_risk ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {data.at_risk ? <AlertTriangle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
            </div>

            {data.at_risk ? (
              <>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-red-600">{totalRecoveryNeeded}</span>
                  <span className="text-xs text-slate-500 ml-2 font-medium">classes to recover</span>
                </div>
                <p className="text-xs text-red-700 mt-3 leading-relaxed">
                  <strong>Warning:</strong> Your attendance is below 75%. You must attend the next <strong>{totalRecoveryNeeded} consecutive classes</strong> without missing to regain semester exam eligibility.
                </p>
              </>
            ) : (
              <>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-slate-800">{data.total_conducted ? `${data.overall_percentage}%` : '—'}</span>
                  <span className="text-xs text-emerald-600 ml-2 font-semibold">{data.total_conducted ? 'Good Standing' : 'Awaiting first session'}</span>
                </div>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {data.total_conducted ? 'No critical attendance deficit detected. Keep attending your scheduled classes.' : 'Your attendance percentage will appear after the first completed session.'}
                </p>
              </>
            )}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Semester Cutoff</span>
            <strong className="text-slate-800">75.0% Required</strong>
          </div>
        </div>
      </div>

      {/* Course Breakdown Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Enrolled Courses & Subject Attendance</h2>
            <p className="text-xs text-slate-500">Real-time attendance updated by multi-image AI sessions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.courses.map((course) => {
            const isAtRisk = course.percentage < 75.0;
            return (
              <div
                key={course.course_id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-300 transition space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {course.course_code}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1 line-clamp-1">
                      {course.course_name}
                    </h4>
                    <p className="text-[11px] text-slate-500">{course.faculty_name}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    isAtRisk ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {course.percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAtRisk ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, course.percentage)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span>{course.attended_classes} / {course.total_classes} attended</span>
                    <span>75% threshold</span>
                  </div>
                </div>

                {/* Metric Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  {isAtRisk ? (
                    <span className="text-red-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Attend next {course.classes_needed_to_recover} classes
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Can safely miss {course.safe_bunk_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Schedule Quick View */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#162456]" />
            Your Academic Schedule (Sample Monday)
          </h3>
          <button
            onClick={() => onNavigate('timetable')}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            View Full Timetable
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {timetable.slice(0, 3).map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{item.course_name}</p>
                <p className="text-[11px] text-slate-500">{item.day_of_week} • {item.start_time} - {item.end_time}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-800">
                {item.room}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
