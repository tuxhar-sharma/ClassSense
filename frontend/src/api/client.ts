import { useAuthStore } from '../store/authStore';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, '');

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("classsense_token");
  
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && token) useAuthStore.getState().logout();
    let errorDetail = "An error occurred";
    try {
      const errJson = await response.json();
      const detail = errJson.detail || errJson.message;
      errorDetail = Array.isArray(detail) ? detail.map((item: any) => item.msg || JSON.stringify(item)).join('; ') : detail || JSON.stringify(errJson);
    } catch {
      errorDetail = `Request failed (${response.status}).`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth
  getSetupStatus: () => apiRequest<{ setup_required: boolean }>("/auth/setup-status"),
  setupAdmin: (data: { email: string; password: string; full_name: string }) => apiRequest<any>("/auth/setup-admin", { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => apiRequest<any>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  registerStudent: (data: any) => apiRequest<any>("/auth/student/register", { method: "POST", body: JSON.stringify(data) }),
  registerFaculty: (data: any) => apiRequest<any>("/auth/faculty/register", { method: "POST", body: JSON.stringify(data) }),
  enrollFace: (photo_base64: string) => apiRequest<any>("/auth/student/enroll-face", { method: "POST", body: JSON.stringify({ photo_base64 }) }),

  // Student
  getStudentProfile: (id: string) => apiRequest<any>(`/students/${id}/profile`),
  getStudentAttendance: (id: string) => apiRequest<any>(`/students/${id}/attendance`),
  getStudentSessions: (id: string) => apiRequest<any>(`/students/${id}/sessions`),
  getStudentTimetable: (id: string) => apiRequest<any>(`/students/${id}/timetable`),
  raiseDispute: (attendance_record_id: string, reason: string) => 
    apiRequest<any>("/students/disputes", { method: "POST", body: JSON.stringify({ attendance_record_id, reason }) }),

  // Faculty
  getFacultyCourses: (facultyId: string) => apiRequest<any>(`/faculty/${facultyId}/courses`),
  getCourseRoster: (id: string) => apiRequest<any>(`/courses/${id}/roster`),
  enrollCourseStudents: (id: string, student_ids: string[]) => apiRequest<{ message: string; enrolled_count: number }>(`/courses/${id}/enrollments`, { method: 'POST', body: JSON.stringify({ student_ids }) }),
  getCourseAttendanceRecords: (courseId: string) => apiRequest<any[]>(`/courses/${courseId}/attendance-records`),
  startSession: (course_id: string, session_type: string) => 
    apiRequest<any>("/sessions", { method: "POST", body: JSON.stringify({ course_id, session_type }) }),
  captureSession: (sessionId: string, images: string[]) => 
    apiRequest<any>(`/sessions/${sessionId}/capture`, { method: "POST", body: JSON.stringify({ images }) }),
  getSessionResults: (sessionId: string) => apiRequest<any>(`/sessions/${sessionId}/results`),
  getCourseSessions: (courseId: string) => apiRequest<any[]>(`/courses/${courseId}/sessions`),
  getSessionRevisions: (sessionId: string) => apiRequest<any[]>(`/sessions/${sessionId}/revisions`),
  retakeSession: (sessionId: string, images: string[], reason: string, expected_revision: number) => apiRequest<any>(`/sessions/${sessionId}/retake`, { method: 'POST', body: JSON.stringify({ images, reason, expected_revision }) }),
  getVerificationQueue: () => apiRequest<any>("/verification-queue"),
  getPendingDisputes: () => apiRequest<any[]>("/faculty/disputes"),
  resolveDispute: (id: string, action: 'approve' | 'reject', reason: string) =>
    apiRequest<any>(`/faculty/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  resolveVerification: (queueId: string, action: string, assigned_student_id?: string) => 
    apiRequest<any>(`/verification-queue/${queueId}/resolve`, { method: "POST", body: JSON.stringify({ action, assigned_student_id }) }),
  overrideAttendance: (recordId: string, new_status: string, reason: string) => 
    apiRequest<any>(`/attendance/${recordId}/override`, { method: "PUT", body: JSON.stringify({ new_status, reason }) }),
  getFacultyAnalytics: (facultyId: string, courseId?: string) => 
    apiRequest<any>(`/faculty/${facultyId}/analytics${courseId ? `?course_id=${courseId}` : ''}`),

  // Admin
  getAdminStats: () => apiRequest<any>("/admin/stats"),
  getPendingFacultyQueue: () => apiRequest<any>("/admin/faculty-verification-queue"),
  approveFaculty: (id: string) => apiRequest<any>(`/admin/faculty-verification-queue/${id}/approve`, { method: "POST" }),
  rejectFaculty: (id: string, rejection_reason?: string) => 
    apiRequest<any>(`/admin/faculty-verification-queue/${id}/reject`, { method: "POST", body: JSON.stringify({ action: "reject", rejection_reason }) }),
  getCourses: () => apiRequest<any>("/admin/courses"),
  getVerifiedFaculty: () => apiRequest<any[]>("/admin/faculty"),
  updateCourse: (id: string, data: any) => apiRequest<any>(`/admin/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCourseTimetable: (id: string) => apiRequest<any[]>(`/admin/courses/${id}/timetable`),
  saveCourseTimetable: (id: string, slots: any[]) => apiRequest<any>(`/admin/courses/${id}/timetable`, { method: 'PUT', body: JSON.stringify({ slots }) }),
  createCourse: (data: any) => apiRequest<any>("/admin/courses", { method: "POST", body: JSON.stringify(data) }),
  uploadRoster: (courseId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<any>(`/admin/rosters/upload?course_id=${encodeURIComponent(courseId)}`, { method: 'POST', body });
  },
  uploadFacultyWhitelist: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest<any>('/admin/faculty-list/upload', { method: 'POST', body });
  },
  getAuditLogs: () => apiRequest<any>("/admin/audit-logs"),
  
  // Export download URLs
  getReportExportUrl: (courseId: string, format: 'excel' | 'pdf') =>
    `${API_BASE}/reports/export?course_id=${courseId}&format=${format}`,
  downloadReport: async (courseId: string, format: 'excel' | 'pdf') => {
    const token = localStorage.getItem('classsense_token');
    const response = await fetch(`${API_BASE}/reports/export?course_id=${encodeURIComponent(courseId)}&format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Report download failed.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
