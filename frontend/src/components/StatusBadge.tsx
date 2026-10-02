import React from 'react';

interface StatusBadgeProps {
  status: 'present' | 'absent' | 'pending_review' | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-medium'
  }[size];

  switch (status.toLowerCase()) {
    case 'present':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0] ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
          Present
        </span>
      );
    case 'absent':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca] ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]"></span>
          Absent
        </span>
      );
    case 'pending_review':
    case 'review':
    case 'pending':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-[#fef3c7] text-[#b45309] border border-[#fde68a] ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] animate-pulse"></span>
          Pending Review
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};
