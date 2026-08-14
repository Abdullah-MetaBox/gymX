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
    // Members, family memberships and subscriptions are ONE screen. 90%+ of
    // members hold a 1:1 subscription, so three sidebar entries were three views
    // of the same rows. /households/* and /subscriptions/* still resolve when
    // typed or linked from a member — they are unlisted, not deleted.
    id: 'members',
    href: '/members',
    labelKey: 'members',
    icon: 'UserRound',
    requires: { action: 'read', subject: 'member' },
    order: 20,
  },
  {
    id: 'plans',
    href: '/plans',
    labelKey: 'plans',
    icon: 'ClipboardList',
    requires: { action: 'read', subject: 'plan' },
    order: 40,
  },
];

/**
 * Screens that exist but do not yet work, kept here so nobody has to re-derive
 * the list. Restore an entry the day its screen does something real — see the
 * file header: a sidebar full of dead links teaches staff to ignore the sidebar.
 *
 *   households    /households      restore if the merged Members screen ever splits
 *   guestPasses   /guest-passes    read: guest_pass
 *   subscriptions /subscriptions   restore when the list adds value over Members
 *   invoices      /invoices        read: invoice
 *   payments      /payments        read: payment
 *   tillShifts    /till-shifts     read: till_shift
 *   access        /access          read: access_event — currently a "Coming soon" stub
 *   team          /team            read: user
 *   auditLog      /audit           read: audit_log
 *   settings      /settings        update: gym
 *   gyms          /platform/gyms   platformOnly
 */

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
