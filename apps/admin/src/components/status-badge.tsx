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
  | 'unpaid';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_ICONS: Record<StatusType, string> = {
  active: '●',
  inactive: '○',
  'on-hold': '⏸',
  overdue: '⚠',
  suspended: '🚫',
  granted: '✓',
  denied: '✗',
  paid: '✓',
  unpaid: '○',
};

const STATUS_COLORS: Record<
  StatusType,
  { bg: string; text: string }
> = {
  active: { bg: 'bg-success/10', text: 'text-success' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600' },
  'on-hold': { bg: 'bg-warning/10', text: 'text-warning' },
  overdue: { bg: 'bg-danger/10', text: 'text-danger' },
  suspended: { bg: 'bg-danger/20', text: 'text-danger' },
  granted: { bg: 'bg-success/10', text: 'text-success' },
  denied: { bg: 'bg-danger/10', text: 'text-danger' },
  paid: { bg: 'bg-success/10', text: 'text-success' },
  unpaid: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const icon = STATUS_ICONS[status];

  const sizeClass =
    size === 'sm'
      ? 'text-xs px-2 py-1'
      : size === 'lg'
        ? 'text-sm px-3 py-1.5'
        : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${sizeClass} ${colors.bg} ${colors.text}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
