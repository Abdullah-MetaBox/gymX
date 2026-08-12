import { count, eq, gte, lt, and, desc } from 'drizzle-orm';
import type { TxDatabase } from '@gymx/db';
import {
  members,
  subscriptions,
  invoices,
  payments,
  accessEvents,
  auditLog,
} from '@gymx/db';
import type { Activity } from '../components/activity-item';
import { Time } from '@gymx/core';

export interface GymStats {
  activeMembers: number;
  monthlyRevenue: number; // in cents
  overdueInvoices: number;
  occupancyNow: { current: number; capacity: number; percent: number };
}

/**
 * Get key statistics for the gym dashboard.
 */
export async function getGymStats(
  db: TxDatabase,
  gymId: string,
  timeZone: string,
): Promise<GymStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Active members count
  const [{ value: activeMemberCount }] = await db
    .select({ value: count(members.id) })
    .from(members)
    .where(and(eq(members.gymId, gymId), eq(members.status, 'active')));

  // Monthly revenue (sum of paid invoices this month)
  const [{ value: monthlyRev }] = await db
    .select({ value: count(invoices.id) }) // Placeholder, should sum totals
    .from(invoices)
    .where(
      and(
        eq(invoices.gymId, gymId),
        gte(invoices.issuedOn, monthStart),
        lt(invoices.issuedOn, now),
      ),
    );

  // Overdue invoices (due date passed, not paid)
  const [{ value: overdueCount }] = await db
    .select({ value: count(invoices.id) })
    .from(invoices)
    .where(
      and(
        eq(invoices.gymId, gymId),
        lt(invoices.dueOn, now),
        // In future: check if unpaid
      ),
    );

  // Occupancy (from access events today)
  // Simplified: count IN and OUT events, subtract for current occupancy
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [{ value: todayEntries }] = await db
    .select({ value: count(accessEvents.id) })
    .from(accessEvents)
    .where(
      and(
        eq(accessEvents.gymId, gymId),
        eq(accessEvents.direction, 'in'),
        gte(accessEvents.at, todayStart),
      ),
    );

  const [{ value: todayExits }] = await db
    .select({ value: count(accessEvents.id) })
    .from(accessEvents)
    .where(
      and(
        eq(accessEvents.gymId, gymId),
        eq(accessEvents.direction, 'out'),
        gte(accessEvents.at, todayStart),
      ),
    );

  const occupancyNow = {
    current: (todayEntries ?? 0) - (todayExits ?? 0),
    capacity: 50, // TODO: Get from gym settings
    percent: Math.round(((todayEntries ?? 0 - (todayExits ?? 0)) / 50) * 100),
  };

  return {
    activeMembers: activeMemberCount ?? 0,
    monthlyRevenue: monthlyRev ?? 0,
    overdueInvoices: overdueCount ?? 0,
    occupancyNow,
  };
}

/**
 * Get recent activities for the activity feed.
 */
export async function getRecentActivities(
  db: TxDatabase,
  gymId: string,
  timeZone: string,
  limit: number = 10,
): Promise<Activity[]> {
  const activities: Activity[] = [];

  // Get recent audit log entries and map to activities
  const auditEntries = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.gymId, gymId))
    .orderBy(desc(auditLog.at))
    .limit(limit * 2); // Get more to filter

  for (const entry of auditEntries) {
    if (entry.entity === 'member' && entry.action === 'create') {
      activities.push({
        id: entry.id,
        type: 'member_created',
        icon: '👤',
        title: 'New member registered',
        description: `${entry.actorEmail} added a new member`,
        timestamp: entry.at,
        timeZone,
        severity: 'info',
      });
    } else if (entry.entity === 'payment' && entry.action === 'create') {
      const diff = entry.diff as Record<string, unknown>;
      const amount = diff.amount_cents ? `Rs ${(diff.amount_cents as number) / 100}` : 'Payment';
      activities.push({
        id: entry.id,
        type: 'payment_recorded',
        icon: '💰',
        title: 'Payment recorded',
        description: `${amount} recorded by ${entry.actorEmail}`,
        timestamp: entry.at,
        timeZone,
        severity: 'info',
      });
    } else if (entry.entity === 'subscription' && entry.action === 'create') {
      activities.push({
        id: entry.id,
        type: 'subscription_created',
        icon: '📋',
        title: 'New subscription',
        description: `New subscription created by ${entry.actorEmail}`,
        timestamp: entry.at,
        timeZone,
        severity: 'info',
      });
    } else if (entry.entity === 'invoice' && entry.action === 'create') {
      activities.push({
        id: entry.id,
        type: 'invoice_issued',
        icon: '📄',
        title: 'Invoice issued',
        description: `Invoice created by ${entry.actorEmail}`,
        timestamp: entry.at,
        timeZone,
        severity: 'info',
      });
    }

    if (activities.length >= limit) break;
  }

  return activities.slice(0, limit);
}

/**
 * Get live occupancy data.
 */
export async function getLiveOccupancy(
  db: TxDatabase,
  gymId: string,
): Promise<{ current: number; capacity: number; percent: number }> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [{ value: entries }] = await db
    .select({ value: count(accessEvents.id) })
    .from(accessEvents)
    .where(
      and(
        eq(accessEvents.gymId, gymId),
        eq(accessEvents.direction, 'in'),
        gte(accessEvents.at, todayStart),
      ),
    );

  const [{ value: exits }] = await db
    .select({ value: count(accessEvents.id) })
    .from(accessEvents)
    .where(
      and(
        eq(accessEvents.gymId, gymId),
        eq(accessEvents.direction, 'out'),
        gte(accessEvents.at, todayStart),
      ),
    );

  const current = (entries ?? 0) - (exits ?? 0);
  const capacity = 50; // TODO: From settings

  return {
    current: Math.max(0, current),
    capacity,
    percent: Math.round((current / capacity) * 100),
  };
}
