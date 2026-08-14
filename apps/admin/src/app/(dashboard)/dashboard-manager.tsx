import { Money, Time } from '@gymx/core';
import { auditLog, invoices, members, visits } from '@gymx/db';
import { and, desc, eq, gte, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import { AlertTriangle, Banknote, UserRound } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { type Activity, ActivityItem } from '../../components/activity-item';
import { KPICard } from '../../components/kpi-card';
import { ProgressRing } from '../../components/progress-ring';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/index';
import { queryInGym } from '../../lib/action';

interface ManagerDashboardProps {
  gymId: string;
  timeZone: string;
}

/**
 * Every figure on this screen is read from the database.
 *
 * It previously rendered hardcoded numbers (247 members, Rs 98,500 revenue) that
 * a viewer had no way to tell from real ones. A dashboard that invents its own
 * figures is worse than no dashboard: it is the "three systems, three truths"
 * failure this product exists to fix, committed on the summary screen.
 */
export async function ManagerDashboard({ timeZone }: ManagerDashboardProps) {
  const t = await getTranslations();

  const { activeMembers, revenueCents, overdueCount, occupancy, activities } = await queryInGym(
    { action: 'read', subject: 'member' },
    async (db) => {
      const now = new Date();

      // Month boundaries in the GYM's zone, not the server's. A payment taken at
      // 23:30 on the 31st in Mauritius belongs to that month, not the next one.
      const { year, month } = Time.partsInZone(now, timeZone);
      const monthStart = Time.wallTimeToInstant(
        { year, month, day: 1, hour: 0, minute: 0 },
        timeZone,
      );
      const nextMonthStart = Time.wallTimeToInstant(
        month === 12
          ? { year: year + 1, month: 1, day: 1, hour: 0, minute: 0 }
          : { year, month: month + 1, day: 1, hour: 0, minute: 0 },
        timeZone,
      );
      const todayKey = Time.dateKeyInZone(now, timeZone);

      const [activeRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(members)
        .where(eq(members.status, 'active'));

      const [revenueRow] = await db
        .select({ total: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::bigint` })
        .from(invoices)
        .where(
          and(
            eq(invoices.status, 'paid'),
            gte(invoices.createdAt, monthStart),
            lt(invoices.createdAt, nextMonthStart),
          ),
        );

      // Overdue = past its due date and not settled. Reads the real dates rather
      // than trusting the `overdue` status, which nothing sets yet.
      const [overdueRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(invoices)
        .where(
          and(
            lt(invoices.dueOn, todayKey),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            ne(invoices.status, 'written_off'),
          ),
        );

      const [occupancyRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(visits)
        .where(and(isNull(visits.exitedAt), lte(visits.enteredAt, now)));

      const auditRows = await db
        .select({
          id: auditLog.id,
          entity: auditLog.entity,
          action: auditLog.action,
          actorEmail: auditLog.actorEmail,
          at: auditLog.at,
        })
        .from(auditLog)
        .orderBy(desc(auditLog.at))
        .limit(8);

      return {
        activeMembers: activeRow?.n ?? 0,
        revenueCents: Number(revenueRow?.total ?? 0),
        overdueCount: overdueRow?.n ?? 0,
        occupancy: occupancyRow?.n ?? 0,
        activities: auditRows.map<Activity>((row) => ({
          id: row.id,
          type: `${row.entity}_${row.action}`,
          icon: ACTIVITY_ICON[row.entity] ?? '•',
          title: `${titleCase(row.entity)} ${row.action.replace(/_/g, ' ')}`,
          description: row.actorEmail ?? t('common.unknown'),
          timestamp: row.at,
          timeZone,
        })),
      };
    },
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t('dashboard.activeMembers')}
          value={activeMembers}
          subtitle={t('dashboard.activeMembersHint')}
          icon={<UserRound size={20} aria-hidden />}
          accentColor="primary"
        />
        <KPICard
          title={t('dashboard.revenue')}
          value={Money.format(Money.cents(revenueCents), { currency: 'MUR' })}
          subtitle={t('dashboard.revenueHint')}
          icon={<Banknote size={20} aria-hidden />}
          accentColor="success"
        />
        <KPICard
          title={t('dashboard.overdue')}
          value={overdueCount}
          subtitle={t('dashboard.overdueHint')}
          icon={<AlertTriangle size={20} aria-hidden />}
          accentColor="warning"
        />
        <div className="surface flex items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] p-6">
          <ProgressRing
            current={occupancy}
            max={OCCUPANCY_CAPACITY}
            label={t('dashboard.occupancy')}
            size="md"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickAction href="/members/new" label={t('members.create')} />
        <QuickAction href="/members" label={t('nav.members')} />
        <QuickAction href="/plans" label={t('nav.plans')} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.activityTitle')}</CardTitle>
        </CardHeader>
        <CardBody>
          {activities.length > 0 ? (
            <div className="space-y-0">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">{t('dashboard.noActivity')}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Placeholder until locations carry a real capacity column. The numerator is
 * real; only the ceiling is assumed.
 */
const OCCUPANCY_CAPACITY = 50;

const ACTIVITY_ICON: Record<string, string> = {
  member: '👤',
  household: '👪',
  subscription: '📋',
  invoice: '🧾',
  payment: '💳',
  plan: '📝',
  gym: '🏋',
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="surface hover:surface-2 flex items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] p-4 text-center text-sm font-medium transition"
    >
      {label}
    </Link>
  );
}
