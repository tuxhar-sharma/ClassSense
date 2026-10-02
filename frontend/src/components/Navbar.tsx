import React from 'react';
import { useAuthStore } from '../store/authStore';
import { LogOut, UserCheck, Shield, GraduationCap } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();

  const roleBadges: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    student: { label: 'Student', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <GraduationCap className="w-3.5 h-3.5" /> },
    faculty: { label: 'Faculty Lead', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <UserCheck className="w-3.5 h-3.5" /> },
    admin: { label: 'System Admin', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Shield className="w-3.5 h-3.5" /> },
  };

  const currentBadge = user ? roleBadges[user.role] : null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-3 md:px-6 flex items-center justify-between shadow-sm">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#162456] flex items-center justify-center text-white font-bold tracking-wider shadow-sm">
          BPIT
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight text-lg">ClassSense</span>
            <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              AI Powered
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Bhagwan Parshuram Institute of Technology • GGSIPU
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* User Badge */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-[#162456] text-white text-xs font-bold flex items-center justify-center shadow-sm">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-none">{user.full_name}</p>
              {currentBadge && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium border px-1.5 py-0.5 rounded-full mt-1 ${currentBadge.color}`}>
                  {currentBadge.icon}
                  {currentBadge.label}
                </span>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
