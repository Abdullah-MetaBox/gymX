import { getTranslations } from 'next-intl/server';
import { KPICard } from '../../components/kpi-card';
import { ActivityItem } from '../../components/activity-item';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/index';
import { getGymStats, getRecentActivities } from '../../lib/dashboard-data';
import { withTenant } from '@gymx/db';
import Link from 'next/link';

interface ManagerDashboardProps {
  gymId: string;
  timeZone: string;
}

export async function ManagerDashboard({ gymId, timeZone }: ManagerDashboardProps) {
  const t = await getTranslations();

  const { stats, activities } = await withTenant({ gymId }, async (db) => {
    const s = await getGymStats(db, gymId, timeZone);
    const a = await getRecentActivities(db, gymId, timeZone, 8);
    return { stats: s, activities: a };
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Active Members"
          value={stats.activeMembers}
          subtitle="Enrolled and active"
          trend={{ value: 8, isPositive: true }}
          icon="👥"
        />
        <KPICard
          title="Revenue"
          value={`Rs ${Math.floor(stats.monthlyRevenue / 100).toLocaleString()}`}
          subtitle="This month"
          trend={{ value: 12, isPositive: true }}
          icon="💰"
        />
        <KPICard
          title="Overdue"
          value={stats.overdueInvoices}
          subtitle="Invoices past due"
          trend={{ value: 5, isPositive: false }}
          icon="⚠"
        />
        <KPICard
          title="Occupancy"
          value={`${stats.occupancyNow.percent}%`}
          subtitle={`${stats.occupancyNow.current}/${stats.occupancyNow.capacity} now`}
          icon="🏢"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionButton href="/members/new" label="New Member" icon="➕" />
        <QuickActionButton href="/payments/new" label="Record Payment" icon="💳" />
        <QuickActionButton href="/subscriptions/new" label="New Subscription" icon="📋" />
        <QuickActionButton href="/reports" label="View Reports" icon="📊" />
      </div>

      {/* Recent Activity */}
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
            <p className="text-sm text-muted">{t('dashboard.noActivity')}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function QuickActionButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link href={href}>
      <Button className="w-full justify-center gap-2" variant="secondary">
        <span>{icon}</span>
        <span>{label}</span>
      </Button>
    </Link>
  );
}
