import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PendingFaculty } from '../../types';
import {
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

export const FacultyApproval: React.FC = () => {
  const [pending, setPending] = useState<PendingFaculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const fetchPendingQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPendingFacultyQueue();
      setPending(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingQueue();
  }, [fetchPendingQueue]);



  const handleApprove = async (id: string, name: string) => {
    try {
      await api.approveFaculty(id);
      setActionMessage(`Faculty account for ${name} has been approved and activated.`);
      setPending((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert("Approval error: " + err.message);
    }
  };

  const handleReject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to reject the registration for ${name}?`)) return;
    try {
      await api.rejectFaculty(id, "Employee credentials not found on departmental records.");
      setActionMessage(`Faculty registration for ${name} rejected and deleted.`);
      setPending((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert("Rejection error: " + err.message);
    }
  };

  const handleWhitelistCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await api.uploadFacultyWhitelist(file);
      setUploadMessage(data.message || "Master employee list imported successfully.");
    } catch (err: any) {
      alert("Upload error: " + err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-700" />
            Faculty Account Verification & Employee Whitelist
          </h1>
          <p className="text-xs text-slate-500">
            Enforces the "Zero Unauthorized Faculty Accounts" requirement via Employee ID cross-checks
          </p>
        </div>

        {/* Master HR Upload Button */}
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-sm">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Upload Master Faculty List (CSV)
          <input type="file" accept=".csv" onChange={handleWhitelistCsv} className="hidden" />
        </label>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploadMessage && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
          <span>{uploadMessage}</span>
          <button onClick={() => setUploadMessage(null)} className="text-blue-700 hover:text-blue-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending Queue List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>Pending Faculty Verification Queue</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
            {pending.length}
          </span>
        </h3>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Checking verification records...
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">No Pending Faculty Approvals</h4>
            <p className="text-xs text-slate-500">All registered faculty accounts have been verified.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                        {f.employee_id}
                      </span>
                      <h4 className="font-bold text-slate-900 text-base mt-1">{f.full_name}</h4>
                      <p className="text-xs text-slate-500">{f.email}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Pending Approval
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Department</span>
                      <span className="font-medium text-slate-800">{f.department}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Designation</span>
                      <span className="font-medium text-slate-800">{f.designation}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    onClick={() => handleReject(f.id, f.full_name)}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject Account
                  </button>
                  <button
                    onClick={() => handleApprove(f.id, f.full_name)}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve & Activate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
