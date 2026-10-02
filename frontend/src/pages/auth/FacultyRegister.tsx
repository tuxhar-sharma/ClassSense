import React, { useState } from 'react';
import { api } from '../../api/client';
import { ArrowLeft, UserCheck, Check, AlertCircle, ShieldAlert, Upload } from 'lucide-react';

interface FacultyRegisterProps {
  onNavigate: (page: string) => void;
}

export const FacultyRegister: React.FC<FacultyRegisterProps> = ({ onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('FAC-102');
  const [email, setEmail] = useState('neha.sharma@bpitindia.edu.in');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('Information Technology');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [officeHours] = useState('Mon-Fri 2:00 PM - 4:00 PM');
  const [idCardBase64, setIdCardBase64] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setIdCardBase64(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.registerFaculty({
        full_name: fullName,
        employee_id: employeeId,
        email,
        password,
        department,
        designation,
        office_hours: officeHours,
        id_card_base64: idCardBase64
      });

      if (res.id_verified) {
        setSuccessMessage("Employee ID verified against Admin Whitelist! Your faculty account is active. You can now log in.");
      } else {
        setSuccessMessage("Registration submitted. Since this Employee ID is not on the immediate pre-approved list, your account has been routed to the Admin Verification Queue for review.");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please verify your Employee ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#162456] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('login')}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold">Faculty Account Registration</h2>
              <p className="text-xs text-blue-200">Employee ID Cross-Check Portal</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* Security Alert */}
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3 text-xs text-amber-800">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Zero Unauthorized Faculty Policy:</span> All faculty accounts are cross-checked against the Admin Master HR Employee List. Employee IDs must match official records.
          </div>
        </div>

        {error && (
          <div className="m-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Registration Complete</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">{successMessage}</p>
            <button
              onClick={() => onNavigate('login')}
              className="px-6 py-2.5 rounded-xl bg-[#162456] text-white text-xs font-bold shadow-sm"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. FAC-101"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kaushik"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official College Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="faculty@bpitindia.edu.in"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                >
                  <option value="Information Technology">Information Technology</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#162456] outline-none"
                />
              </div>
            </div>

            {/* ID Card Attachment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Faculty ID Card / Institutional Badge (Optional verification attachment)
              </label>
              <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <span className="text-xs text-slate-600">
                  {idCardBase64 ? "ID Card attached (click to replace)" : "Upload ID Card scan"}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 transition shadow-md shadow-blue-950/10 flex items-center justify-center gap-2"
            >
              {loading ? "Verifying with Master HR List..." : "Submit Faculty Registration"}
              <Check className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
