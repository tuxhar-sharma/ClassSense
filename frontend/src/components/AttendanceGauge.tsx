import React from 'react';

interface AttendanceGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showTarget?: boolean;
}

export const AttendanceGauge: React.FC<AttendanceGaugeProps> = ({
  percentage,
  size = 180,
  strokeWidth = 14,
  showTarget = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  let color = '#16a34a'; // Success green
  let statusText = 'Eligible';
  let badgeBg = 'bg-green-100 text-green-800';

  if (safePercentage < 65) {
    color = '#dc2626'; // Red
    statusText = 'Critical Shortage';
    badgeBg = 'bg-red-100 text-red-800';
  } else if (safePercentage < 75) {
    color = '#d97706'; // Amber
    statusText = 'At Risk (<75%)';
    badgeBg = 'bg-amber-100 text-amber-800';
  }

  return (
    <div className="flex flex-col items-center justify-center relative">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tracking-tight text-slate-900">
          {percentage.toFixed(1)}%
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${badgeBg}`}>
          {statusText}
        </span>
      </div>
      {showTarget && (
        <div className="mt-3 text-xs font-medium text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          Minimum Required: <strong className="text-slate-700">75.0%</strong>
        </div>
      )}
    </div>
  );
};
