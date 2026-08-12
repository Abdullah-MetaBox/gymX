# UI Implementation Guide

How to build out the new design system using Tailwind + branding from database.

## Setup: Branding-Aware Theme Provider

### 1. Create a Theme Context

**File: `apps/admin/src/lib/theme.ts`**

```typescript
import { type GymBranding } from '@gymx/db';

export interface ThemeColors {
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export function getBrandingColors(branding?: GymBranding): ThemeColors {
  return {
    primary: branding?.primaryColor ?? '#FF6B35',
    accent: branding?.accentColor ?? '#004E89',
    success: '#06A77D',
    warning: '#F77F00',
    danger: '#D62828',
  };
}

export function injectCSSVariables(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-success', colors.success);
  root.style.setProperty('--color-warning', colors.warning);
  root.style.setProperty('--color-danger', colors.danger);
}
```

### 2. Update Tailwind Config

**File: `apps/admin/tailwind.config.ts`**

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--color-warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--color-danger-rgb) / <alpha-value>)',
      },
    },
  },
};
```

### 3. Inject Theme in Layout

**File: `apps/admin/src/app/layout.tsx`** (at the top)

```typescript
'use client';

import { useEffect } from 'react';
import { getBrandingColors, injectCSSVariables } from '@/lib/theme';

export default function RootLayout({ 
  children, 
  branding 
}: { 
  children: React.ReactNode;
  branding?: GymBranding;
}) {
  useEffect(() => {
    const colors = getBrandingColors(branding);
    injectCSSVariables(colors);
  }, [branding]);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## Component Updates

### Header with Logo

**File: `apps/admin/src/components/header.tsx`** (new)

```tsx
import type { GymBranding } from '@gymx/db';

interface HeaderProps {
  gymName: string;
  logoUrl?: string;
  branding?: GymBranding;
}

export function Header({ gymName, logoUrl, branding }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4"
            style={{ borderColor: branding?.accentColor }}>
      <div className="flex items-center gap-2">
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt={gymName} 
            className="h-6 w-6 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none'; // Hide if fails to load
            }}
          />
        )}
        <span className="font-bold text-sm">{gymName}</span>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Gym switcher, locale, theme toggle, sign out */}
      </div>
    </header>
  );
}
```

### Sidebar with Logo

**File: `apps/admin/src/components/sidebar.tsx`** (update)

```tsx
interface SidebarProps {
  logoUrl?: string;
  gymName: string;
  branding?: GymBranding;
  entries: NavEntry[];
}

export function Sidebar({ logoUrl, gymName, branding, entries }: SidebarProps) {
  return (
    <aside className="flex w-60 flex-col border-r">
      {/* Logo + Gym Name at top */}
      <div className="flex h-14 items-center gap-2 border-b px-4"
           style={{ backgroundColor: branding?.primaryColor + '10' }}>
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt={gymName}
            className="h-8 w-8 object-contain"
          />
        )}
        <span className="font-bold text-xs">{gymName}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {entries.map((entry) => (
          <NavLink key={entry.id} entry={entry} branding={branding} />
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="border-t p-3">
        {/* User details */}
      </div>
    </aside>
  );
}
```

### Sign-In Page with Branding

**File: `apps/admin/src/app/sign-in/page.tsx`** (update)

```tsx
export default async function SignInPage({ 
  searchParams 
}: { 
  searchParams: Record<string, string> 
}) {
  // Try to get gym branding from DB if a gym is pre-selected
  const gymId = searchParams.gym;
  const branding = gymId ? await getGymBranding(gymId) : null;
  const colors = getBrandingColors(branding);

  return (
    <div 
      className="flex min-h-screen items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`
      }}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-2xl">
        {/* Logo */}
        {branding?.logoUrl && (
          <img 
            src={branding.logoUrl}
            alt="Gym logo"
            className="mx-auto mb-6 h-20 w-20 object-contain"
          />
        )}

        {/* Title */}
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          {branding?.gymName || 'GymX'}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Management Portal
        </p>

        {/* Form */}
        <SignInForm />
      </div>
    </div>
  );
}
```

---

## Dashboard Components

### KPI Card Component

**File: `apps/admin/src/components/kpi-card.tsx`** (new)

```tsx
interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: React.ReactNode;
  primaryColor?: string;
}

export function KPICard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon, 
  primaryColor 
}: KPICardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted uppercase">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-2 text-xs font-medium ${
              trend.isPositive ? 'text-success' : 'text-danger'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div 
            className="rounded-lg p-2 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Manager Dashboard

**File: `apps/admin/src/app/(dashboard)/dashboard/manager.tsx`** (new)

```tsx
export async function ManagerDashboard({ 
  context, 
  branding 
}: {
  context: ActiveContext;
  branding: GymBranding;
}) {
  const stats = await getGymStats(context.actor.gymId);
  const activities = await getRecentActivities(context.actor.gymId);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard 
          title="Active Members"
          value={stats.activeMembers}
          trend={{ value: 8, isPositive: true }}
          primaryColor={branding.primaryColor}
        />
        <KPICard 
          title="Revenue (This Month)"
          value={`Rs ${stats.monthlyRevenue.toLocaleString()}`}
          trend={{ value: 5, isPositive: true }}
          primaryColor={branding.accentColor}
        />
        <KPICard 
          title="Overdue Invoices"
          value={stats.overdueCount}
          trend={{ value: 3, isPositive: false }}
          primaryColor={branding.primaryColor}
        />
        <KPICard 
          title="Occupancy (Now)"
          value={`${stats.occupancyPercent}%`}
          subtitle={`${stats.occupancyCurrent}/${stats.occupancyMax}`}
          primaryColor={branding.accentColor}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <QuickActionButton 
          label="New Member" 
          href="/members/new"
          primaryColor={branding.primaryColor}
        />
        <QuickActionButton 
          label="Record Payment" 
          href="/payments/new"
          primaryColor={branding.primaryColor}
        />
        <QuickActionButton 
          label="Check In" 
          href="/access/check-in"
          primaryColor={branding.primaryColor}
        />
        <QuickActionButton 
          label="View Reports" 
          href="/reports"
          primaryColor={branding.primaryColor}
        />
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Status Badge Component

**File: `apps/admin/src/components/status-badge.tsx`** (new)

```tsx
type StatusType = 'active' | 'inactive' | 'on-hold' | 'overdue' | 'suspended' | 'granted' | 'denied';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_STYLES: Record<StatusType, { bg: string; text: string; icon: string }> = {
  active: { bg: 'bg-success/10', text: 'text-success', icon: '●' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '○' },
  'on-hold': { bg: 'bg-warning/10', text: 'text-warning', icon: '⏸' },
  overdue: { bg: 'bg-danger/10', text: 'text-danger', icon: '!' },
  suspended: { bg: 'bg-danger/20', text: 'text-danger', icon: 'X' },
  granted: { bg: 'bg-success/10', text: 'text-success', icon: '✓' },
  denied: { bg: 'bg-danger/10', text: 'text-danger', icon: '✗' },
};

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : 
                   size === 'lg' ? 'text-sm px-3 py-2' : 
                   'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${style.bg} ${style.text}`}>
      <span>{style.icon}</span>
      <span>{label}</span>
    </span>
  );
}
```

---

## Member List Component

**File: `apps/admin/src/components/member-list-card.tsx`** (new)

```tsx
interface MemberListCardProps {
  members: Member[];
  primaryColor?: string;
}

export function MemberListCard({ members, primaryColor }: MemberListCardProps) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div 
          key={member.id}
          className="rounded-lg border p-4 hover:shadow-md cursor-pointer transition"
        >
          {/* Name + Code */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{member.name}</h3>
              <p className="text-xs text-muted">ID: {member.code}</p>
            </div>
            <StatusBadge 
              status={member.status as StatusType}
              label={member.status}
            />
          </div>

          {/* Contact */}
          <div className="mt-2 text-sm text-muted">
            <p>{member.email}</p>
            <p>{member.phone}</p>
          </div>

          {/* Plan + Joined */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span>{member.planName}</span>
            <span className="text-muted">Joined {member.joinedDate}</span>
          </div>

          {/* Quick Actions */}
          <div className="mt-3 flex gap-2">
            <button className="text-xs hover:underline" style={{ color: primaryColor }}>
              View
            </button>
            <button className="text-xs hover:underline" style={{ color: primaryColor }}>
              Edit
            </button>
            <button className="ml-auto text-xs text-muted hover:underline">
              More →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Button Component (Updated)

**File: `apps/admin/src/components/button.tsx`** (update)

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  primaryColor?: string;
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  primaryColor,
  ...props 
}: ButtonProps) {
  const baseClass = 'font-medium rounded-lg transition inline-flex items-center justify-center gap-2';
  
  const variantClass = {
    primary: `text-white hover:opacity-90`,
    secondary: `border text-primary hover:bg-primary/5`,
    danger: `bg-danger text-white hover:opacity-90`,
    success: `bg-success text-white hover:opacity-90`,
    warning: `bg-warning text-white hover:opacity-90`,
  }[variant];

  const sizeClass = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  const style = variant === 'primary' ? {
    backgroundColor: primaryColor
  } : {};

  return (
    <button 
      className={`${baseClass} ${variantClass} ${sizeClass}`}
      style={style}
      {...props}
    />
  );
}
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Create theme provider + CSS variables
- [ ] Update header with logo support
- [ ] Update sidebar with logo
- [ ] Update sign-in page with branding

### Week 2: Dashboard
- [ ] Create KPI card component
- [ ] Build manager dashboard
- [ ] Build staff dashboard
- [ ] Build accountant dashboard
- [ ] Add quick action buttons

### Week 3: Features
- [ ] Redesign member list
- [ ] Update member detail page
- [ ] Improve payment recording UI
- [ ] Update access log display

### Week 4: Polish
- [ ] Responsive design testing
- [ ] Accessibility audit
- [ ] Color contrast verification
- [ ] Dark mode (if desired)
- [ ] Performance optimization

---

## Testing Branding

### Local Test
```bash
# Update gym branding in database
psql $APP_DATABASE_URL
UPDATE gyms SET branding = '{"primaryColor":"#FF6B35","accentColor":"#004E89","logoUrl":"https://example.com/logo.png"}' WHERE id = 'gym-abc-id';

# Refresh app
pnpm dev
# Check if colors + logo appear in header, sidebar, login
```

### Verification Checklist
- [ ] Logo appears in header
- [ ] Logo appears in sidebar  
- [ ] Logo appears on sign-in page
- [ ] Primary color applied to buttons
- [ ] Accent color applied to accents (borders, hovers)
- [ ] Colors work on light + dark backgrounds
- [ ] Different color palettes don't break layout
