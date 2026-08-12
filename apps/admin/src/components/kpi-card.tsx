'use client';

import { memo } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: React.ReactNode;
  accentColor?: 'primary' | 'success' | 'warning' | 'error';
}

function KPICardComponent({ title, value, subtitle, trend, icon, accentColor = 'primary' }: KPICardProps) {
  const accentMap = {
    primary: 'bg-[#00FF41]/10 text-[#00FF41]',
    success: 'bg-[#10B981]/15 text-[#10B981]',
    warning: 'bg-[#D946EF]/15 text-[#D946EF]',
    error: 'bg-[#EF4444]/15 text-[#EF4444]',
  };

  return (
    <div className="rounded-lg border border-[#D1D5DB] dark:border-[#4B5563] bg-white dark:bg-[#2D2D35] p-6 shadow-sm hover:shadow-lg hover:border-[#9CA3AF] dark:hover:border-[#6B7280] transition cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#9CA3AF] dark:text-[#6B7280] uppercase tracking-wider">{title}</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-[#0B0B0F] dark:text-[#E5E7EB]">{value}</p>
          {subtitle && <p className="mt-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{subtitle}</p>}
          {trend && (
            <p
              className={`mt-3 text-xs font-medium ${
                trend.isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last month
            </p>
          )}
        </div>
        {icon && (
          <div className={`shrink-0 rounded-lg p-3 text-2xl ${accentMap[accentColor]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export const KPICard = memo(KPICardComponent);
