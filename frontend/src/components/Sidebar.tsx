import React from 'react';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Camera,
  CheckSquare,
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  History,
  ShieldCheck,
  ScanFace,
  Users
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  pendingQueueCount?: number;
  pendingFacultyCount?: number;
}

interface SidebarLink {
  id: string;
  label: string;
  icon: any;
  badge?: number;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  pendingQueueCount = 0,
  pendingFacultyCount = 0
}) => {
  const { user } = useAuthStore();
  const role = user?.role || 'student';

  const studentLinks: SidebarLink[] = [
    { id: 'dashboard', label: 'Overview & Gauge', icon: LayoutDashboard },
    { id: 'history', label: 'Attendance History', icon: Clock },
    { id: 'timetable', label: 'Weekly Timetable', icon: Calendar },
    { id: 'face-enroll', label: 'Facial Biometric Enrolment', icon: ScanFace },
  ];

  const facultyLinks: SidebarLink[] = [
    { id: 'faculty-dashboard', label: 'Course Overview', icon: LayoutDashboard },
    { id: 'class-roster', label: 'Class Roster & Enrollment', icon: Users },
    { id: 'capture', label: 'Classroom AI Capture', icon: Camera },
    { id: 'session-history', label: 'Session History & Retakes', icon: Clock },
    { 
      id: 'queue', 
      label: 'Verification Queue', 
      icon: CheckSquare,
      badge: pendingQueueCount > 0 ? pendingQueueCount : undefined,
      badgeColor: 'bg-amber-500'
    },
    { id: 'overrides', label: 'Manual Overrides', icon: History },
    { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  ];

  const adminLinks: SidebarLink[] = [
    { id: 'admin-dashboard', label: 'System Overview', icon: LayoutDashboard },
    { 
      id: 'faculty-approvals', 
      label: 'Faculty Approvals', 
      icon: ShieldCheck,
      badge: pendingFacultyCount > 0 ? pendingFacultyCount : undefined,
      badgeColor: 'bg-purple-600'
    },
    { id: 'admin-courses', label: 'Course Directory', icon: BookOpen },
    { id: 'roster-upload', label: 'Bulk Roster Import', icon: FileSpreadsheet },
    { id: 'audit-logs', label: 'Immutable Audit Trail', icon: History },
  ];

  const links = role === 'student' ? studentLinks : (role === 'faculty' ? facultyLinks : adminLinks);

  return (
    <aside className="w-16 md:w-[260px] bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] sticky top-16 select-none">
      <div className="p-2 md:p-4 space-y-1">
        <div className="hidden md:block px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {role === 'student' ? 'Student Portal' : (role === 'faculty' ? 'Faculty Controls' : 'Administration')}
        </div>

        {links.map((link) => {
          const Icon = link.icon;
          const isActive = currentPage === link.id;

          return (
            <button
              key={link.id}
              title={link.label}
              aria-label={link.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(link.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-[#162456] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="hidden md:inline">{link.label}</span>
              </div>
              {link.badge !== undefined && (
                <span className={`hidden md:inline text-[11px] px-2 py-0.5 rounded-full text-white font-bold ${link.badgeColor}`}>
                  {link.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="hidden md:block p-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
          <span className="text-[11px] font-semibold text-slate-700">BPIT Smart Attendance v1.0</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          ArcFace 512-d recognition
        </p>
      </div>
    </aside>
  );
};
