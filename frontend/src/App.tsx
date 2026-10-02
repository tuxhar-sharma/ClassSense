import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from './store/authStore';
import { api } from './api/client';

// Shared Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { StudentRegister } from './pages/auth/StudentRegister';
import { FacultyRegister } from './pages/auth/FacultyRegister';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentHistory } from './pages/student/StudentHistory';
import { StudentTimetable } from './pages/student/StudentTimetable';
import { StudentFaceEnroll } from './pages/student/StudentFaceEnroll';

// Faculty Pages
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { ClassRoster } from './pages/faculty/ClassRoster';
import { SessionHistory } from './pages/faculty/SessionHistory';
import { SessionCapture } from './pages/faculty/SessionCapture';
import { VerificationQueue } from './pages/faculty/VerificationQueue';
import { AttendanceEditor } from './pages/faculty/AttendanceEditor';
import { FacultyAnalytics } from './pages/faculty/FacultyAnalytics';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { FacultyApproval } from './pages/admin/FacultyApproval';
import { CourseManagement } from './pages/admin/CourseManagement';
import { RosterUpload } from './pages/admin/RosterUpload';
import { AuditLogs } from './pages/admin/AuditLogs';

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [requestedPage, setRequestedPage] = useState<string>('');
  const [pageOwner, setPageOwner] = useState<string | undefined>(user?.id);
  const defaultPage = user?.role === 'student' ? 'dashboard' : user?.role === 'faculty' ? 'faculty-dashboard' : user?.role === 'admin' ? 'admin-dashboard' : 'login';
  const currentPage = pageOwner === user?.id && requestedPage ? requestedPage : defaultPage;
  const [pageParams, setPageParams] = useState<any>(null);

  // Badge counts
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [pendingFacultyCount, setPendingFacultyCount] = useState(0);

  const fetchBadges = useCallback(async () => {
    try {
      if (user?.role === 'faculty') {
        const [q, disputes] = await Promise.all([api.getVerificationQueue(), api.getPendingDisputes()]);
        setPendingQueueCount(q.length + disputes.length);
      } else if (user?.role === 'admin') {
        const f = await api.getPendingFacultyQueue();
        setPendingFacultyCount(f.length);
      }
    } catch {
      // ignore badge fetch error on initial load
    }
  }, [user]);

  useEffect(() => {
    const refresh = () => { void fetchBadges(); };
    refresh();
    window.addEventListener('classsense-data-changed', refresh);
    return () => window.removeEventListener('classsense-data-changed', refresh);
  }, [fetchBadges]);

  const handleNavigate = (page: string, params?: any) => {
    setPageOwner(user?.id);
    setRequestedPage(page);
    setPageParams(params || null);
    fetchBadges();
  };

  // Render unauthenticated screens
  if (!isAuthenticated) {
    if (currentPage === 'register-student') {
      return <StudentRegister onNavigate={handleNavigate} />;
    }
    if (currentPage === 'register-faculty') {
      return <FacultyRegister onNavigate={handleNavigate} />;
    }
    return <LoginPage onNavigate={handleNavigate} />;
  }

  // Render main authenticated shell
  const renderContent = () => {
    // Student Views
    if (user?.role === 'student') {
      switch (currentPage) {
        case 'dashboard':
          return <StudentDashboard onNavigate={handleNavigate} />;
        case 'history':
          return <StudentHistory />;
        case 'timetable':
          return <StudentTimetable />;
        case 'face-enroll':
          return <StudentFaceEnroll />;
        default:
          return <StudentDashboard onNavigate={handleNavigate} />;
      }
    }

    // Faculty Views
    if (user?.role === 'faculty') {
      switch (currentPage) {
        case 'faculty-dashboard':
          return <FacultyDashboard onNavigate={handleNavigate} />;
        case 'class-roster':
          return <ClassRoster initialCourseId={pageParams?.courseId} />;
        case 'session-history':
          return <SessionHistory initialCourseId={pageParams?.courseId} initialSessionId={pageParams?.sessionId} onNavigate={handleNavigate} />;
        case 'capture':
          return <SessionCapture onNavigate={handleNavigate} initialCourseId={pageParams?.courseId} />;
        case 'queue':
          return <VerificationQueue />;
        case 'overrides':
          return <AttendanceEditor />;
        case 'analytics':
          return <FacultyAnalytics />;
        default:
          return <FacultyDashboard onNavigate={handleNavigate} />;
      }
    }

    // Admin Views
    if (user?.role === 'admin') {
      switch (currentPage) {
        case 'admin-dashboard':
          return <AdminDashboard onNavigate={handleNavigate} />;
        case 'faculty-approvals':
          return <FacultyApproval />;
        case 'admin-courses':
          return <CourseManagement />;
        case 'roster-upload':
          return <RosterUpload />;
        case 'audit-logs':
          return <AuditLogs />;
        default:
          return <AdminDashboard onNavigate={handleNavigate} />;
      }
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          pendingQueueCount={pendingQueueCount}
          pendingFacultyCount={pendingFacultyCount}
        />
        <main className="flex-1 min-w-0 overflow-y-auto pb-12">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
