import { Time } from '@gymx/core';

export interface Activity {
  id: string;
  /** `${entity}_${action}` from the audit trail. Free-form: a new phase adds
   *  entities without touching this component. */
  type: string;
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
  timeZone: string;
  severity?: 'info' | 'success' | 'warning' | 'danger';
}

const SEVERITY_COLOR: Record<NonNullable<Activity['severity']>, string> = {
  info: 'text-[var(--color-primary)]',
  success: 'text-[#10B981]',
  warning: 'text-[#D946EF]',
  danger: 'text-[#EF4444]',
};

/** Derived from the audit action so the caller does not have to classify. */
function severityOf(activity: Activity): NonNullable<Activity['severity']> {
  if (activity.severity) return activity.severity;
  if (/(delete|cancel|denied|reverse|void)/.test(activity.type)) return 'danger';
  if (/(archive|hold|suspend|overdue)/.test(activity.type)) return 'warning';
  if (/(paid|payment|granted)/.test(activity.type)) return 'success';
  return 'info';
}

export function ActivityItem({ activity }: { activity: Activity }) {
  const timeStr = Time.formatInstant(activity.timestamp, {
    timeZone: activity.timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="hover:surface-2 flex gap-4 border-b border-[var(--color-border)] py-4 transition-colors last:border-b-0">
      <div className={`shrink-0 text-lg font-medium ${SEVERITY_COLOR[severityOf(activity)]}`}>
        {activity.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{activity.title}</p>
        <p className="text-muted mt-1 text-xs">{activity.description}</p>
      </div>
      <time
        dateTime={activity.timestamp.toISOString()}
        className="text-muted shrink-0 whitespace-nowrap text-xs"
      >
        {timeStr}
      </time>
    </div>
  );
}
