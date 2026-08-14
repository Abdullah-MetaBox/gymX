'use client';

type StatusType =
  | 'active'
  | 'inactive'
  | 'on-hold'
  | 'overdue'
  | 'suspended'
  | 'granted'
  | 'denied'
  | 'paid'
  | 'unpaid'
  | 'frozen';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<StatusType, { icon: string; bg: string; text: string }> = {
  active: { icon: '●', bg: 'bg-[#10B981]/15', text: 'text-[#10B981]' },
  inactive: { icon: '○', bg: 'bg-[#4B5563]/20', text: 'text-[#B5BAC1]' },
  'on-hold': { icon: '⏸', bg: 'bg-[#D946EF]/15', text: 'text-[#D946EF]' },
  overdue: { icon: '⚠', bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]' },
  suspended: { icon: '🚫', bg: 'bg-[#EF4444]/20', text: 'text-[#EF4444]' },
  granted: { icon: '✓', bg: 'bg-[#10B981]/15', text: 'text-[#10B981]' },
  denied: { icon: '✗', bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]' },
  paid: { icon: '✓', bg: 'bg-[#10B981]/15', text: 'text-[#10B981]' },
  unpaid: { icon: '○', bg: 'bg-[#4B5563]/20', text: 'text-[#B5BAC1]' },
  frozen: { icon: '❄', bg: 'bg-[#D946EF]/15', text: 'text-[#D946EF]' },
};

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClass =
    size === 'sm'
      ? 'text-xs px-2 py-1'
      : size === 'lg'
        ? 'text-sm px-3 py-1.5'
        : 'text-xs px-2.5 py-1.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${sizeClass} ${config.bg} ${config.text}`}
    >
      <span className="text-sm">{config.icon}</span>
      <span>{label}</span>
    </span>
  );
}
