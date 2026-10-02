import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { FacultyCourse, VerificationQueueItem } from '../../types';
import {
  Camera,
  CheckSquare,
  Users,
  BookOpen,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';

interface FacultyDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<FacultyCourse[]>([]);
  const [pendingQueue, setPendingQueue] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disputeCount, setDisputeCount] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Find faculty ID from courses or user
      const coursesRes = await api.getFacultyCourses(user.id);
      setCourses(coursesRes);
      const queueRes = await api.getVerificationQueue();
      setPendingQueue(queueRes);
      setDisputeCount((await api.getPendingDisputes()).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your courses.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);



  const totalStudents = courses.reduce((acc, c) => acc + c.enrolled_count, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading faculty dashboard...</p>}
      {!loading && !error && courses.length === 0 && <p className="text-sm text-slate-500">No courses assigned yet. Ask your administrator to assign your teaching courses.</p>}
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#162456] to-[#1c2d6b] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full text-blue-200">
            Faculty Teaching Portal
          </span>
          <h1 className="text-2xl font-bold mt-2">Welcome, {user?.full_name}!</h1>
          <p className="text-xs text-blue-200 mt-1">
            Department of Information Technology & Computer Science • BPIT
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('capture')}
            className="px-5 py-2.5 rounded-xl bg-[#991b1b] hover:bg-[#7f1d1d] text-white text-xs font-bold transition shadow-md flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Start AI Classroom Session
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Verification Queue Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Verification Queue
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <CheckSquare className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600">{pendingQueue.length + disputeCount}</span>
              <span className="text-xs text-slate-500 font-medium">flagged students pending</span>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Detections with ambiguous or single-image sightings routed for human review. Resolves in &lt; 2 minutes.
            </p>
          </div>

          <button
            onClick={() => onNavigate('queue')}
            disabled={pendingQueue.length + disputeCount === 0}
            className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
          >
            Review Flagged Queue
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Assigned Courses */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Courses
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{courses.length}</span>
              <span className="text-xs text-slate-500 font-medium">classes assigned</span>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Semester B.Tech IT & CSE batches configured with enrolled facial vector embeddings.
            </p>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>Total Enrolled:</span>
            <strong className="text-slate-800 font-bold">{totalStudents} students</strong>
          </div>
        </div>

        {/* Fast Actions & Reports */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Department Reports
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
            <h4 className="text-sm font-bold text-slate-800 mt-1">Official Attendance Sheets</h4>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Instant generation of Excel (.xlsx) matrix grids and printable official PDF registers with signature blocks.
            </p>
          </div>

          <button
            onClick={() => onNavigate('analytics')}
            className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold text-[#162456] bg-slate-100 hover:bg-slate-200 transition flex items-center justify-center gap-1.5"
          >
            Analytics & Reports
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Courses Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your Assigned Courses</h2>
            <p className="text-xs text-slate-500">Launch a multi-image attendance capture for any class session</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-blue-300 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                    {course.course_code}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Room: {course.room}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mt-3">{course.course_name}</h3>
                <p className="text-xs text-slate-500 mt-1">{course.branch} · {course.semester} · {course.section}</p>
                <button onClick={() => onNavigate('class-roster', { courseId: course.id })} className="text-xs font-semibold text-blue-700 py-2">Manage class roster & enroll students</button>
                <p className="text-xs text-slate-500 mt-1">{course.credits} Credits • Lecture & Lab</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span><strong>{course.enrolled_count}</strong> Enrolled Students</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('capture', { courseId: course.id })}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Take Attendance
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
