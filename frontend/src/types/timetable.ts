export interface TimetableSubject {
  course_name: string;
  course_code: string;
  faculty_ids: string[];
  lab_group: string;
}
export interface PublishedSlot extends TimetableSubject {
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  session_type: string;
  source_note: string;
  period: string;
  notation: string;
}
export interface TimetableDraft {
  title: string;
  branch: string;
  semester: string;
  section: string;
  effective_from: string;
  entries: PublishedSlot[];
  subjects: TimetableSubject[];
  notes: string[];
  expected_revision: number;
  source_document: string;
}
export interface DirectoryCourse {
  id: string; course_code: string; course_name: string; subject_code: string;
  branch: string; semester: string; section: string; lab_group: string;
  faculty_name: string; enrolled_count: number; room: string; is_active: boolean;
}
export interface DirectoryPerson {
  id: string; full_name: string; email: string; courses: DirectoryCourse[];
  employee_id?: string; verified?: boolean; enrollment_no?: string;
  branch?: string; semester?: string; section?: string; lab_group?: string;
}
