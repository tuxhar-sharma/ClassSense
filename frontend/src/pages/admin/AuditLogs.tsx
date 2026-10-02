import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AuditLogItem } from '../../types';
import { History, ShieldCheck, Search} from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      setLogs(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);



  const filtered = logs.filter(
    (l) =>
      l.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-[#162456]" />
          Immutable Attendance Audit Trail
        </h1>
        <p className="text-xs text-slate-500">
          Permanent log of all manual overrides, dispute resolutions, and verification decisions
        </p>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail by student, course, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none bg-white"
            />
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Tamper-Resistant Log
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3.5 px-6">Timestamp</th>
                <th className="py-3.5 px-6">Student</th>
                <th className="py-3.5 px-6">Course</th>
                <th className="py-3.5 px-6">Change</th>
                <th className="py-3.5 px-6">Authorized By</th>
                <th className="py-3.5 px-6">Mandatory Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No manual attendance overrides recorded in the audit trail yet.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const dateStr = new Date(log.changed_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        {log.student_name}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        {log.course_name}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1 font-mono text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                            {log.old_value}
                          </span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase font-bold">
                            {log.new_value}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-700 font-medium">
                        {log.changed_by_name}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 text-[11px] italic max-w-xs truncate" title={log.reason}>
                        "{log.reason}"
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
