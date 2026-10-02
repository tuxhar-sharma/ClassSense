export type Role = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  email: string;
  role: Role;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: Role;
  user_id: string;
  full_name: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  enrollment_no: string;
  semester: string;
  branch: string;
  section: string;
  phone?: string;
  face_enrolled: boolean;
  photo_url?: string;
}

export interface CourseAttendanceSummary {
  course_id: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
  total_classes: number;
  attended_classes: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical';
  safe_bunk_count: number;
  classes_needed_to_recover: number;
}

export interface StudentOverallAttendance {
  total_conducted: number;
  total_attended: number;
  overall_percentage: number;
  at_risk: boolean;
  courses: CourseAttendanceSummary[];
}

export interface SessionHistoryItem {
  record_id: string;
  session_id: string;
  course_code: string;
  course_name: string;
  session_date: string;
  session_type: string;
  status: 'present' | 'absent' | 'pending_review';
  confidence_score: number;
  auto_marked: boolean;
  faculty_verified: boolean;
  dispute_status?: 'pending' | 'approved' | 'rejected' | null;
}

export interface TimetableItem {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  session_type: string;
}

export interface FacultyCourse {
  branch: string;
  semester: string;
  section: string;
  id: string;
  course_code: string;
  course_name: string;
  room: string;
  credits: number;
  enrolled_count: number;
}

export interface StudentMatchResult {
  student_id: string;
  enrollment_no: string;
  full_name: string;
  status: 'present' | 'absent' | 'pending_review';
  confidence_score: number;
  auto_marked: boolean;
  photo_url?: string;
  appearances: number;
}

export interface SessionResults {
  revision: number;
  status: string;
  image_count: number;
  session_id: string;
  course_name: string;
  session_date: string;
  session_type: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  review_count: number;
  records: StudentMatchResult[];
}

export interface VerificationQueueItem {
  id: string;
  session_id: string;
  course_code: string;
  course_name: string;
  session_date: string;
  candidate_student_id: string;
  candidate_name: string;
  candidate_enrollment_no: string;
  candidate_photo_url?: string;
  similarity_score: number;
  face_crop_data?: string;
  resolution_status: 'pending' | 'confirmed' | 'rejected' | 'manual';
}

export interface TrendPoint {
  label: string;
  attendance_rate: number;
  total_sessions: number;
}

export interface AtRiskStudent {
  student_id: string;
  enrollment_no: string;
  full_name: string;
  course_id: string;
  course_name: string;
  attended: number;
  total: number;
  percentage: number;
  classes_needed: number;
}

export interface FacultyAnalytics {
  course_id?: string;
  average_attendance: number;
  total_sessions_conducted: number;
  total_students_enrolled: number;
  trends: TrendPoint[];
  at_risk_students: AtRiskStudent[];
}

export interface AdminStats {
  total_students: number;
  total_faculty: number;
  pending_faculty_approvals: number;
  total_courses: number;
  total_attendance_sessions: number;
  average_system_attendance: number;
}

export interface PendingFaculty {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_id: string;
  designation: string;
  department: string;
  id_card_url?: string;
  created_at: string;
  id_verified: boolean;
}

export interface AuditLogItem {
  id: string;
  attendance_record_id: string;
  student_name: string;
  course_name: string;
  changed_by_name: string;
  old_value: string;
  new_value: string;
  reason: string;
  changed_at: string;
}
