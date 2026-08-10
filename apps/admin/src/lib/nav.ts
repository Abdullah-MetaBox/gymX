import type { Action, Role, Subject } from '@gymx/core/auth';
import { can } from '@gymx/core/auth';
import { collectNavItems } from '@gymx/modules';

/**
 * Navigation, composed from permissions and enabled modules.
 *
 * Two consequences that matter beyond Phase 0:
 *   - A later phase adds a screen by adding an entry here with the permission
 *     it needs. It never edits a role check.
 *   - A module contributes nav through the registry, so a tenant-specific
 *     screen appears without core knowing the tenant exists.
 *
 * Only screens that actually work are listed. A sidebar full of greyed-out
 * "coming soon" links teaches staff to ignore the sidebar.
 */

export interface NavEntry {
  id: string;
  href: string;
  /** Key into the `nav` section of the message catalogue. */
  labelKey: string;
  icon: string;
  requires?: { action: Action; subject: Subject };
  /** Platform console entries, shown only to platform admins. */
  platformOnly?: boolean;
  order: number;
}

const CORE_NAV: NavEntry[] = [
  { id: 'dashboard', href: '/', labelKey: 'dashboard', icon: 'LayoutDashboard', order: 10 },
  {
    id: 'members',
    href: '/members',
    labelKey: 'members',
    icon: 'UserRound',
    requires: { action: 'read', subject: 'member' },
    order: 20,
  },
  {
    id: 'households',
    href: '/households',
    labelKey: 'households',
    icon: 'Home',
    requires: { action: 'read', subject: 'household' },
    order: 25,
  },
  {
    id: 'guestPasses',
    href: '/guest-passes',
    labelKey: 'guestPasses',
    icon: 'Ticket',
    requires: { action: 'read', subject: 'guest_pass' },
    order: 30,
  },
  {
    id: 'plans',
    href: '/plans',
    labelKey: 'plans',
    icon: 'ClipboardList',
    requires: { action: 'read', subject: 'plan' },
    order: 40,
  },
  {
    id: 'subscriptions',
    href: '/subscriptions',
    labelKey: 'subscriptions',
    icon: 'CreditCard',
    requires: { action: 'read', subject: 'subscription' },
    order: 50,
  },
  {
    id: 'invoices',
    href: '/invoices',
    labelKey: 'invoices',
    icon: 'FileText',
    requires: { action: 'read', subject: 'invoice' },
    order: 55,
  },
  {
    id: 'payments',
    href: '/payments',
    labelKey: 'payments',
    icon: 'Wallet',
    requires: { action: 'read', subject: 'payment' },
    order: 60,
  },
  {
    id: 'tillShifts',
    href: '/till-shifts',
    labelKey: 'tillShifts',
    icon: 'ReceiptCents',
    requires: { action: 'read', subject: 'till_shift' },
    order: 65,
  },
  {
    id: 'access',
    href: '/access',
    labelKey: 'access',
    icon: 'DoorOpen',
    requires: { action: 'read', subject: 'access_event' },
    order: 67,
  },
  {
    id: 'team',
    href: '/team',
    labelKey: 'team',
    icon: 'Users',
    requires: { action: 'read', subject: 'user' },
    order: 75,
  },
  {
    id: 'auditLog',
    href: '/audit',
    labelKey: 'auditLog',
    icon: 'ScrollText',
    requires: { action: 'read', subject: 'audit_log' },
    order: 85,
  },
  {
    id: 'settings',
    href: '/settings',
    labelKey: 'settings',
    icon: 'Settings',
    requires: { action: 'update', subject: 'gym' },
    order: 95,
  },
  {
    id: 'gyms',
    href: '/platform/gyms',
    labelKey: 'gyms',
    icon: 'Building2',
    platformOnly: true,
    order: 105,
  },
];

export interface NavContext {
  role: Role;
  isPlatformAdmin: boolean;
  enabledModules: readonly string[];
  gymId: string | null;
  locale: string;
  timeZone: string;
}

export function navFor(context: NavContext): NavEntry[] {
  const core = CORE_NAV.filter((entry) => {
    if (entry.platformOnly) return context.isPlatformAdmin;
    if (!entry.requires) return true;
    return can(context.role, entry.requires.action, entry.requires.subject);
  });

  const fromModules = context.gymId
    ? collectNavItems(context.enabledModules, {
        gymId: context.gymId,
        locale: context.locale,
        timeZone: context.timeZone,
      }).map<NavEntry>((item, index) => ({
        id: item.id,
        href: item.href,
        labelKey: item.label,
        icon: item.icon ?? 'Puzzle',
        requires: item.requires,
        order: item.order ?? 200 + index,
      }))
    : [];

  const visibleModuleItems = fromModules.filter(
    (entry) => !entry.requires || can(context.role, entry.requires.action, entry.requires.subject),
  );

  return [...core, ...visibleModuleItems].sort((a, b) => a.order - b.order);
}
