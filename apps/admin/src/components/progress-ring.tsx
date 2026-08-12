'use client';

interface ProgressRingProps {
  current: number;
  max: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressRing({ current, max, label, size = 'md' }: ProgressRingProps) {
  const percentage = Math.min((current / max) * 100, 100);

  // Determine color based on percentage
  let ringColor = '#10B981'; // Green (0-70%)
  if (percentage >= 90) ringColor = '#EF4444'; // Red (90%+)
  else if (percentage >= 70) ringColor = '#D946EF'; // Purple (70-90%)

  const sizeConfig = {
    sm: { radius: 30, circumference: 188.4, width: 80 },
    md: { radius: 45, circumference: 282.6, width: 120 },
    lg: { radius: 60, circumference: 376.8, width: 160 },
  };

  const config = sizeConfig[size];
  const strokeDashoffset = config.circumference - (percentage / 100) * config.circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={config.width} height={config.width} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={config.radius}
          stroke="#D1D5DB"
          strokeWidth="4"
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={config.radius}
          stroke={ringColor}
          strokeWidth="4"
          fill="none"
          strokeDasharray={config.circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <div className="text-center">
        <p className="text-lg font-bold text-[#0B0B0F]">
          {current}/{max}
        </p>
        <p className="text-xs text-[#6B7280] mt-1">{label}</p>
      </div>
    </div>
  );
}
