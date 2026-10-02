import React, { useEffect, useState } from 'react';
import { InitialSetup } from './InitialSetup';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { Role } from '../../types';
import { GraduationCap, UserCheck, Shield, Lock, Mail, ArrowRight} from 'lucide-react';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api.getSetupStatus().then(status => { if (active) setSetupRequired(status.setup_required); })
      .catch(error => { if (active) { setError(error instanceof Error ? error.message : 'Cannot connect to the server.'); setSetupRequired(false); } });
    return () => { active = false; };
  }, []);

  const { login } = useAuthStore();

  const handleTabChange = (tab: Role) => {
    setActiveTab(tab);
    setError(null);
    setEmail('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.login({ email, password, role: activeTab });
      login(data.access_token, {
        id: data.user_id,
        email,
        role: data.role,
        full_name: data.full_name
      });
      onNavigate(activeTab === 'student' ? 'dashboard' : (activeTab === 'faculty' ? 'faculty-dashboard' : 'admin-dashboard'));
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  if (setupRequired === null) return <div className="min-h-screen flex items-center justify-center text-slate-600">Connecting to ClassSense...</div>;
  if (setupRequired) return <InitialSetup />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full">
        {/* College Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#162456] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3 shadow-md shadow-blue-950/20">
            BPIT
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            BPIT Smart Attendance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Department of Information Technology • GGSIPU
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
          {/* Role Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleTabChange('student')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'student'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              Student
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('faculty')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'faculty'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Faculty
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              Admin
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bpitindia.edu.in"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#162456] focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#162456] focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#162456] hover:bg-[#101a40] disabled:opacity-50 transition shadow-md shadow-blue-950/10"
            >
              {loading ? "Authenticating..." : `Sign In as ${activeTab.toUpperCase()}`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Registration Links */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
            {activeTab === 'student' ? (
              <button
                onClick={() => onNavigate('register-student')}
                className="text-blue-700 hover:underline font-semibold"
              >
                New Student? Enroll Selfie & Face
              </button>
            ) : activeTab === 'faculty' ? (
              <button
                onClick={() => onNavigate('register-faculty')}
                className="text-emerald-700 hover:underline font-semibold"
              >
                Faculty Registration (Employee ID)
              </button>
            ) : (
              <span className="text-slate-400">Department Admin Access Only</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
