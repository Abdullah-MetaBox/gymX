'use client';

import { Time } from '@gymx/core';

export interface Activity {
  id: string;
  type: 'member_created' | 'payment_recorded' | 'subscription_created' | 'subscription_cancelled' | 'invoice_issued' | 'access_granted' | 'access_denied';
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
  timeZone: string;
  severity?: 'info' | 'warning' | 'danger';
}

const ACTIVITY_ICONS: Record<Activity['type'], string> = {
  member_created: '👤',
  payment_recorded: '💰',
  subscription_created: '📋',
  subscription_cancelled: '⏹',
  invoice_issued: '📄',
  access_granted: '✓',
  access_denied: '✗',
};

const ACTIVITY_COLORS: Record<Activity['type'], string> = {
  member_created: 'text-blue-600',
  payment_recorded: 'text-success',
  subscription_created: 'text-blue-600',
  subscription_cancelled: 'text-warning',
  invoice_issued: 'text-blue-600',
  access_granted: 'text-success',
  access_denied: 'text-danger',
};

interface ActivityItemProps {
  activity: Activity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const timeStr = Time.formatInstant(activity.timestamp, {
    timeZone: activity.timeZone,
    format: 'compact',
  });

  const iconClass = ACTIVITY_COLORS[activity.type];
  const icon = ACTIVITY_ICONS[activity.type];

  return (
    <div className="flex gap-3 py-3 border-b last:border-b-0">
      <div className={`text-lg shrink-0 ${iconClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{activity.title}</p>
        <p className="text-xs text-muted mt-0.5">{activity.description}</p>
      </div>
      <time className="text-xs text-muted shrink-0 whitespace-nowrap">{timeStr}</time>
    </div>
  );
}
