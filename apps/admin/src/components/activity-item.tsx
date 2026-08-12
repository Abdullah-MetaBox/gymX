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
  member_created: 'text-[#00D9FF]',
  payment_recorded: 'text-[#10B981]',
  subscription_created: 'text-[#00D9FF]',
  subscription_cancelled: 'text-[#D946EF]',
  invoice_issued: 'text-[#00D9FF]',
  access_granted: 'text-[#10B981]',
  access_denied: 'text-[#EF4444]',
};

interface ActivityItemProps {
  activity: Activity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const timeStr = Time.formatInstant(activity.timestamp, {
    timeZone: activity.timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const iconClass = ACTIVITY_COLORS[activity.type];
  const icon = ACTIVITY_ICONS[activity.type];

  return (
    <div className="flex gap-4 py-4 border-b border-[#E5E7EB] dark:border-[#3F3F47] last:border-b-0 hover:bg-[#F9FAFB] dark:hover:bg-[#292529] transition-colors cursor-pointer">
      <div className={`text-lg shrink-0 font-medium ${iconClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#111827] dark:text-[#FFFFFF]">{activity.title}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A0A0A8] mt-1">{activity.description}</p>
      </div>
      <time className="text-xs text-[#6B7280] dark:text-[#A0A0A8] shrink-0 whitespace-nowrap">{timeStr}</time>
    </div>
  );
}
