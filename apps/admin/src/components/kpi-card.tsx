'use client';

import * as icons from 'lucide-react';
import { memo } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  /**
   * A lucide icon NAME, not an element.
   *
   * lucide-react carries no 'use client', so an icon rendered inside a server
   * component and passed here crosses the boundary as an unserializable module
   * reference — "Only plain objects can be passed to Client Components".
   * Resolving the name on this side keeps the crossing to a string, and matches
   * how nav-links.tsx already handles the same problem.
   */
  icon?: string;
  accentColor?: 'primary' | 'success' | 'warning' | 'error';
}

const ACCENTS = {
  primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  success: 'bg-[#10B981]/15 text-[#10B981]',
  warning: 'bg-[#D946EF]/15 text-[#D946EF]',
  error: 'bg-[#EF4444]/15 text-[#EF4444]',
} as const;

function Icon({ name }: { name: string }) {
  const Resolved = (icons as unknown as Record<string, icons.LucideIcon>)[name] ?? icons.Circle;
  return <Resolved className="h-5 w-5" aria-hidden />;
}

function KPICardComponent({
  title,
  value,
  subtitle,
  trend,
  icon,
  accentColor = 'primary',
}: KPICardProps) {
  return (
    <div className="surface rounded-[var(--radius-card)] border border-[var(--color-border)] p-6 transition hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted font-medium text-xs uppercase tracking-wider">{title}</p>
          <p className="mt-3 font-bold text-4xl tracking-tight">{value}</p>
          {subtitle ? <p className="text-muted mt-2 text-sm">{subtitle}</p> : null}
          {trend ? (
            <p
              className={`mt-3 font-medium text-xs ${
                trend.isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last month
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className={`shrink-0 rounded-lg p-3 ${ACCENTS[accentColor]}`}>
            <Icon name={icon} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const KPICard = memo(KPICardComponent);
