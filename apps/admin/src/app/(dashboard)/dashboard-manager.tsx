import { getTranslations } from 'next-intl/server';
import { KPICard } from '../../components/kpi-card';
import { ProgressRing } from '../../components/progress-ring';
import { ActivityItem, type Activity } from '../../components/activity-item';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/index';
import Link from 'next/link';

interface ManagerDashboardProps {
  gymId: string;
  timeZone: string;
}

export async function ManagerDashboard({ gymId, timeZone }: ManagerDashboardProps) {
  const t = await getTranslations();

  // Mock data for demo (in real implementation, this would come from database)
  const stats = {
    activeMembers: 247,
    monthlyRevenue: 9850000, // in cents
    overdueInvoices: 12,
    occupancyNow: { current: 34, capacity: 50, percent: 68 },
  };

  const activities: Activity[] = [
    {
      id: '1',
      type: 'payment_recorded',
      icon: '💰',
      title: 'Payment recorded',
      description: 'Rs 5,000 from Alice Johnson',
      timestamp: new Date(Date.now() - 300000),
      timeZone,
    },
    {
      id: '2',
      type: 'member_created',
      icon: '👤',
      title: 'New member registered',
      description: 'manager@gymabc.test added a new member',
      timestamp: new Date(Date.now() - 900000),
      timeZone,
    },
    {
      id: '3',
      type: 'subscription_created',
      icon: '📋',
      title: 'New subscription',
      description: 'Family plan subscription created',
      timestamp: new Date(Date.now() - 1800000),
      timeZone,
    },
    {
      id: '4',
      type: 'access_granted',
      icon: '✓',
      title: 'Access granted',
      description: 'Alice Johnson checked in (Lunch access)',
      timestamp: new Date(Date.now() - 2700000),
      timeZone,
    },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Active Members"
          value={stats.activeMembers}
          subtitle="Enrolled and active"
          trend={{ value: 8, isPositive: true }}
          icon="👥"
          accentColor="primary"
        />
        <KPICard
          title="Revenue"
          value={`Rs ${Math.floor(stats.monthlyRevenue / 100).toLocaleString()}`}
          subtitle="This month"
          trend={{ value: 12, isPositive: true }}
          icon="💰"
          accentColor="success"
        />
        <KPICard
          title="Overdue"
          value={stats.overdueInvoices}
          subtitle="Invoices past due"
          trend={{ value: 5, isPositive: false }}
          icon="⚠"
          accentColor="warning"
        />
        <div className="rounded-lg border border-[#D1D5DB] dark:border-[#4B5563] bg-white dark:bg-[#2D2D35] p-6 flex items-center justify-center hover:shadow-lg hover:border-[#9CA3AF] dark:hover:border-[#6B7280] transition cursor-pointer">
          <ProgressRing
            current={stats.occupancyNow.current}
            max={stats.occupancyNow.capacity}
            label="Occupancy"
            size="md"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionButton href="/members/new" label="New Member" icon="➕" />
        <QuickActionButton href="/payments" label="Record Payment" icon="💳" />
        <QuickActionButton href="/subscriptions" label="New Subscription" icon="📋" />
        <QuickActionButton href="/components-demo" label="View Components" icon="🎨" />
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
    <Link
      href={href}
      className="rounded-lg border border-[#D1D5DB] dark:border-[#4B5563] bg-white dark:bg-[#2D2D35] p-4 text-center hover:shadow-lg hover:border-[#9CA3AF] dark:hover:border-[#6B7280] hover:bg-[#F9FAFB] dark:hover:bg-[#3F3F47] transition flex items-center justify-center gap-2 text-sm font-medium text-[#0B0B0F] dark:text-[#E5E7EB] cursor-pointer"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
