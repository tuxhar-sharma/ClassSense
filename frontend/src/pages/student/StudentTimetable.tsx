import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { TimetableItem } from '../../types';
import { Calendar, Clock, MapPin} from 'lucide-react';

export const StudentTimetable: React.FC = () => {
  const { user } = useAuthStore();
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const fetchTimetable = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const profile = await api.getStudentProfile(user.id);
      const res = await api.getStudentTimetable(profile.id);
      setTimetable(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load timetable.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading timetable...</p>}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#162456]" />
          Weekly Class & Lab Timetable
        </h1>
        <p className="text-xs text-slate-500">
          Your enrolled courses and scheduled sessions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {days.map((day) => {
          const dayClasses = timetable.filter((t) => t.day_of_week === day);

          return (
            <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                <h3 className="font-bold text-slate-800 text-sm">{day}</h3>
                <span className="text-[11px] text-slate-400">{dayClasses.length} sessions</span>
              </div>

              <div className="p-3 space-y-3 flex-1">
                {dayClasses.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-slate-400">
                    No classes scheduled
                  </div>
                ) : (
                  dayClasses.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {item.course_code}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.session_type === 'Lab' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.session_type}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                        {item.course_name}
                      </h4>

                      <div className="space-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.start_time} - {item.end_time}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.room}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
