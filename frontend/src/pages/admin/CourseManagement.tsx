import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CourseTimetableEditor } from '../../components/CourseTimetableEditor';
import { ClassFields } from '../../components/ClassFields';
import { CourseClassEditor } from '../../components/CourseClassEditor';
import { BookOpen, Plus, Users, X, Building } from 'lucide-react';

export const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [facultyId, setFacultyId] = useState('');
  const [error, setError] = useState('');
  const [timetableCourseId, setTimetableCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [room, setRoom] = useState('LH-204');
  const [credits, setCredits] = useState(4);
  const [classDetails, setClassDetails] = useState({ branch: '', semester: '', section: '' });
  const [editingClass, setEditingClass] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const [res, faculty] = await Promise.all([api.getCourses(), api.getVerifiedFaculty()]);
      setCourses(res);
      setFaculty(faculty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);



  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createCourse({
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        room,
        credits,
        faculty_id: facultyId || null,
        ...classDetails, section: classDetails.section.trim(),
      });
      setIsModalOpen(false);
      setCourseCode('');
      setCourseName('');
      fetchCourses();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {!loading && !error && courses.length === 0 && <p className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">Create a course with its class details and assign approved faculty. Faculty can enroll matching registrations from Class Roster.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#162456]" />
            Course Catalog & Curriculum Management
          </h1>
          <p className="text-xs text-slate-500">
            Configure courses, sections, classroom assignments, and faculty allocations
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New Course
        </button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            Loading courses...
          </div>
        ) : courses.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-300 transition flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                  {c.course_code}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {c.credits} Credits
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-2">{c.course_name}</h3>
              <p className="text-xs text-slate-500 mt-1">Lead: {c.faculty_name}</p>
              <label className="block text-xs mt-3">Assigned faculty
                <select value={c.faculty_id || ''} disabled={submitting} className="w-full border p-2 rounded-lg mt-1" onChange={async event => {
                  setSubmitting(true);
                  setError('');
                  try {
                    await api.updateCourse(c.id, { ...c, faculty_id: event.target.value || null });
                    await fetchCourses();
                  } catch (error) { setError(error instanceof Error ? error.message : 'Could not assign faculty.'); }
                  finally { setSubmitting(false); }
                }}>
                  <option value="">Unassigned</option>
                  {faculty.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </label>
              <button className="mt-3 text-xs text-blue-700 font-semibold" onClick={() => setTimetableCourseId(c.id)}>Edit weekly timetable</button>
              <p className="text-xs text-slate-600 mt-3">{c.branch && c.semester && c.section ? `${c.branch} · ${c.semester} semester · ${c.section}` : 'Class details required for faculty enrollment'}</p>
              <button className="mt-2 text-xs text-blue-700 font-semibold" onClick={() => setEditingClass(c)}>Edit class details</button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {c.room}
              </span>
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                {c.enrolled_count} Students
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* New Course Modal */}
      {timetableCourseId && <CourseTimetableEditor courseId={timetableCourseId} onClose={() => setTimetableCourseId(null)} />}
      {editingClass && <CourseClassEditor course={editingClass} onClose={() => setEditingClass(null)} onSaved={() => { void fetchCourses(); }} />}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Add New Course</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="mt-4 space-y-3">
              <ClassFields value={classDetails} onChange={setClassDetails} />
              <label className="block text-xs font-semibold">Faculty
                <select value={facultyId} onChange={event => setFacultyId(event.target.value)} className="w-full border rounded-lg p-2 mt-1">
                  <option value="">Assign later</option>
                  {faculty.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </select>
              </label>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT310"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Computing & DevOps"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room</label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={credits}
                    onChange={(e) => setCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] rounded-lg transition"
                >
                  {submitting ? "Creating..." : "Save Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
