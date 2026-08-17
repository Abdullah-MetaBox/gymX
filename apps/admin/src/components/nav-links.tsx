'use client';

import * as icons from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';

export interface NavLinkEntry {
  id: string;
  href: string;
  label: string;
  icon: string;
  comingSoon?: boolean;
  /** Localised badge text, e.g. "Soon". */
  comingSoonLabel?: string;
}

function Icon({ name }: { name: string }) {
  const Component = (icons as unknown as Record<string, icons.LucideIcon>)[name];
  const Fallback = icons.Circle;
  const Resolved = Component ?? Fallback;
  return <Resolved className="h-4 w-4 shrink-0" aria-hidden />;
}

const ROW = 'flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors';

export function NavLinks({ entries }: { entries: NavLinkEntry[] }) {
  const pathname = usePathname();

  return (
    <>
      {entries.map((entry) => {
        // Rendered as a <span>, not a disabled link: there is no href to follow,
        // so it cannot be clicked, middle-clicked, or reached by keyboard — a
        // greyed-out anchor still navigates.
        if (entry.comingSoon) {
          return (
            <span
              key={entry.id}
              className={cn(ROW, 'text-muted cursor-default opacity-55 select-none')}
            >
              <Icon name={entry.icon} />
              <span className="flex-1 truncate">{entry.label}</span>
              <span className="shrink-0 rounded-full border border-[var(--color-border)] px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide">
                {entry.comingSoonLabel}
              </span>
            </span>
          );
        }

        const active = entry.href === '/' ? pathname === '/' : pathname.startsWith(entry.href);

        return (
          <Link
            key={entry.id}
            href={entry.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              ROW,
              'cursor-pointer',
              active
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'text-[var(--color-fg)] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D35]',
            )}
          >
            <Icon name={entry.icon} />
            {entry.label}
          </Link>
        );
      })}
    </>
  );
}
