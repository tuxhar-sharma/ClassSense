import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AdminStats } from '../../types';
import {
  Users,
  UserCheck,
  BookOpen,
  Calendar,
  History,
  TrendingUp,
  FileSpreadsheet,
  ShieldCheck
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminStats();
      setStats(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load system statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);



  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {loading && <p className="text-sm text-slate-500">Loading system statistics...</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#162456] via-[#101a40] to-purple-950 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full text-purple-200">
            Institutional Administration
          </span>
          <h1 className="text-2xl font-bold mt-2">Department Administrator Console</h1>
          <p className="text-xs text-purple-200 mt-1">
            Bhagwan Parshuram Institute of Technology • System Governance & Roster Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats && stats.pending_faculty_approvals > 0 && (
            <button
              onClick={() => onNavigate('faculty-approvals')}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {stats.pending_faculty_approvals} Pending Faculty Verifications
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Enrolled Students
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {stats?.total_students || 0}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1 font-medium">
              Registered student accounts
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Faculty Members
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {stats?.total_faculty || 0}
            </p>
            <p className="text-[11px] text-purple-600 mt-1 font-medium">
              Employee ID Whitelist Checked
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Courses
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {stats?.total_courses || 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              B.Tech IT Curricula
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              AI Classroom Sessions
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {stats?.total_attendance_sessions || 0}
            </p>
            <p className="text-[11px] text-blue-600 mt-1">
              Multi-Image Aggregations Processed
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Overall Institute Attendance
            </span>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {stats?.average_system_attendance || 0}%
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">
              Department-wide Average
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pending Approvals
            </span>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">
              {stats?.pending_faculty_approvals || 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              HR Cross-Check Queue
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-red-50 text-red-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('faculty-approvals')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-sm text-left transition space-y-2"
        >
          <ShieldCheck className="w-6 h-6 text-purple-600" />
          <h4 className="font-bold text-slate-900 text-sm">Faculty Verification</h4>
          <p className="text-xs text-slate-500">Review pending registrations against employee records.</p>
        </button>

        <button
          onClick={() => onNavigate('admin-courses')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-sm text-left transition space-y-2"
        >
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h4 className="font-bold text-slate-900 text-sm">Course Directory</h4>
          <p className="text-xs text-slate-500">Configure courses, credit hours, and assign faculty leads.</p>
        </button>

        <button
          onClick={() => onNavigate('roster-upload')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm text-left transition space-y-2"
        >
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <h4 className="font-bold text-slate-900 text-sm">Bulk Roster Upload</h4>
          <p className="text-xs text-slate-500">Import student batch lists via standardized CSV format.</p>
        </button>

        <button
          onClick={() => onNavigate('audit-logs')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-300 hover:shadow-sm text-left transition space-y-2"
        >
          <History className="w-6 h-6 text-amber-600" />
          <h4 className="font-bold text-slate-900 text-sm">Immutable Audit Trail</h4>
          <p className="text-xs text-slate-500">Inspect full audit log of all manual attendance overrides.</p>
        </button>
      </div>
    </div>
  );
};
