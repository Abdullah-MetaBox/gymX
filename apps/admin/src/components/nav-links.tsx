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
}

function Icon({ name }: { name: string }) {
  const Component = (icons as unknown as Record<string, icons.LucideIcon>)[name];
  const Fallback = icons.Circle;
  const Resolved = Component ?? Fallback;
  return <Resolved className="h-4 w-4 shrink-0" aria-hidden />;
}

export function NavLinks({ entries }: { entries: NavLinkEntry[] }) {
  const pathname = usePathname();

  return (
    <>
      {entries.map((entry) => {
        const active = entry.href === '/' ? pathname === '/' : pathname.startsWith(entry.href);

        return (
          <Link
            key={entry.id}
            href={entry.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors cursor-pointer',
              active
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'text-[var(--color-fg)] hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D35] hover:rounded-lg',
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
