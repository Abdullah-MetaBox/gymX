import { KPICard } from '../../../components/kpi-card';
import { StatusBadge } from '../../../components/status-badge';
import { ProgressRing } from '../../../components/progress-ring';
import { MemberCard } from '../../../components/member-card';
import { FilterChip } from '../../../components/filter-chip';
import { CheckInDisplay } from '../../../components/check-in-display';
import { ActivityItem, type Activity } from '../../../components/activity-item';
import { PageHeader } from '../../../components/ui';

export default function ComponentsDemoPage() {
  const demoActivity: Activity = {
    id: '1',
    type: 'payment_recorded',
    icon: '💰',
    title: 'Payment recorded',
    description: 'Rs 5,000 from Alice Johnson',
    timestamp: new Date(),
    timeZone: 'Indian/Mauritius',
  };

  return (
    <>
      <PageHeader
        title="Component Showcase"
        subtitle="Research-backed design components from Peloton, Mindbody, and Apple Health"
      />

      <div className="space-y-12">
        {/* KPI Cards Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">KPI Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Active Members"
              value="247"
              subtitle="Enrolled and active"
              trend={{ value: 8, isPositive: true }}
              icon="👥"
              accentColor="primary"
            />
            <KPICard
              title="Revenue"
              value="Rs 98,500"
              subtitle="This month"
              trend={{ value: 12, isPositive: true }}
              icon="💰"
              accentColor="success"
            />
            <KPICard
              title="Overdue"
              value="12"
              subtitle="Invoices past due"
              trend={{ value: 5, isPositive: false }}
              icon="⚠"
              accentColor="warning"
            />
            <KPICard
              title="Occupancy"
              value="68%"
              subtitle="Right now"
              icon="🏢"
              accentColor="error"
            />
          </div>
        </section>

        {/* Status Badges Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Status Badges</h2>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="active" label="Active" />
            <StatusBadge status="inactive" label="Inactive" />
            <StatusBadge status="frozen" label="Frozen" />
            <StatusBadge status="suspended" label="Suspended" />
            <StatusBadge status="overdue" label="Overdue" />
            <StatusBadge status="granted" label="Granted" />
            <StatusBadge status="denied" label="Denied" />
            <StatusBadge status="paid" label="Paid" />
          </div>
        </section>

        {/* Progress Ring Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Progress Ring (Occupancy)</h2>
          <div className="flex gap-12">
            <ProgressRing current={15} max={50} label="Low (30%)" size="md" />
            <ProgressRing current={35} max={50} label="Medium (70%)" size="md" />
            <ProgressRing current={48} max={50} label="High (96%)" size="md" />
          </div>
        </section>

        {/* Member Card Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Member Card</h2>
          <div className="max-w-md">
            <MemberCard
              id="member-1"
              name="Alice Johnson"
              memberCode="MEM-0001"
              email="alice@example.com"
              phone="+230-231-4567"
              status="active"
              membershipType="Family"
              household={{ name: "Johnson Family", memberCount: 3 }}
              joinedDate="6 months ago"
            />
          </div>
        </section>

        {/* Filter Chips Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Filter Chips</h2>
          <div className="flex flex-wrap gap-2">
            <FilterChip label="All" selected icon="📋" />
            <FilterChip label="Active" icon="✓" />
            <FilterChip label="Frozen" icon="❄" />
            <FilterChip label="Suspended" icon="🚫" />
            <FilterChip label="Overdue" icon="⚠" />
          </div>
        </section>

        {/* Check-In Display Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Check-In Display</h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-[#6B7280] mb-2">Granted</p>
              <CheckInDisplay
                memberName="Alice Johnson"
                status="granted"
                membershipType="Family"
                occupancy={{ current: 34, max: 50 }}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-[#6B7280] mb-2">Denied</p>
              <CheckInDisplay
                memberName="Bob Smith"
                status="denied"
                reason="Payment due May 15. Please contact staff to re-enable access."
              />
            </div>
          </div>
        </section>

        {/* Activity Feed Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Activity Timeline</h2>
          <div className="max-w-md border border-[#D1D5DB] rounded-lg p-4">
            <ActivityItem activity={demoActivity} />
            <ActivityItem
              activity={{
                id: '2',
                type: 'member_created',
                icon: '👤',
                title: 'New member registered',
                description: 'manager@gymabc.test added a new member',
                timestamp: new Date(Date.now() - 3600000),
                timeZone: 'Indian/Mauritius',
              }}
            />
            <ActivityItem
              activity={{
                id: '3',
                type: 'subscription_created',
                icon: '📋',
                title: 'New subscription',
                description: 'Family plan subscription created',
                timestamp: new Date(Date.now() - 7200000),
                timeZone: 'Indian/Mauritius',
              }}
            />
          </div>
        </section>

        {/* Color Palette Section */}
        <section>
          <h2 className="text-lg font-semibold text-[#0B0B0F] mb-4">Color Palette</h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="text-center">
              <div className="w-full h-16 rounded-lg bg-[#0B0B0F] mb-2"></div>
              <p className="text-xs font-medium">#0B0B0F</p>
              <p className="text-xs text-[#6B7280]">Base</p>
            </div>
            <div className="text-center">
              <div className="w-full h-16 rounded-lg bg-[#00FF41] mb-2"></div>
              <p className="text-xs font-medium">#00FF41</p>
              <p className="text-xs text-[#6B7280]">Primary</p>
            </div>
            <div className="text-center">
              <div className="w-full h-16 rounded-lg bg-[#10B981] mb-2"></div>
              <p className="text-xs font-medium">#10B981</p>
              <p className="text-xs text-[#6B7280]">Success</p>
            </div>
            <div className="text-center">
              <div className="w-full h-16 rounded-lg bg-[#D946EF] mb-2"></div>
              <p className="text-xs font-medium">#D946EF</p>
              <p className="text-xs text-[#6B7280]">Warning</p>
            </div>
            <div className="text-center">
              <div className="w-full h-16 rounded-lg bg-[#EF4444] mb-2"></div>
              <p className="text-xs font-medium">#EF4444</p>
              <p className="text-xs text-[#6B7280]">Error</p>
            </div>
            <div className="text-center">
              <div className="w-full h-16 rounded-lg border-2 border-[#D1D5DB] bg-white mb-2"></div>
              <p className="text-xs font-medium">#D1D5DB</p>
              <p className="text-xs text-[#6B7280]">Border</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
