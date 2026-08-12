# GymX UI/UX Design System

## Design Principles (Fitness Industry Best Practices)

1. **Quick access** — Staff needs to check members in fast (2 taps max)
2. **High contrast** — Busy gym environment, readability critical
3. **Mobile-first** — Day-to-day ops happen on tablets/phones
4. **Clear hierarchy** — Most important info (member status, payment status) jumps out
5. **Trust through clarity** — Money is involved; every number must be unambiguous

---

## Color Scheme (Customizable per Gym)

### Primary Colors (GymABC Defaults)
- **Primary**: `#FF6B35` (energetic orange)
- **Accent**: `#004E89` (deep trust blue)
- **Success**: `#06A77D` (green, for "granted", "paid")
- **Warning**: `#F77F00` (amber, for "overdue", "on hold")
- **Danger**: `#D62828` (red, for "denied", "suspended")

### Neutrals
- **Foreground**: `#1a1a1a` (near black, text)
- **Muted**: `#666666` (secondary text)
- **Border**: `#e0e0e0` (light borders)
- **Surface**: `#f8f8f8` (backgrounds)

---

## Layout Components

### 1. Header/Top Bar
```
┌─────────────────────────────────────────────────────────┐
│  [Logo] [Gym Name]        [Locale] [Theme] [Sign Out]   │
└─────────────────────────────────────────────────────────┘
```

**Logo specifications:**
- Size: 24px × 24px (or 40px × 40px for large screens)
- Format: PNG with transparency
- Placement: Top-left, next to "GymX" or gym name
- If `logoUrl` set: Load and display
- If not set: Show placeholder or app name only

**Example implementations:**
```tsx
<header className="flex items-center justify-between h-14 bg-white border-b">
  <div className="flex items-center gap-2 pl-4">
    {logoUrl && (
      <img src={logoUrl} alt="Gym logo" className="h-6 w-6" />
    )}
    <h1 className="text-sm font-bold">{gymName}</h1>
  </div>
  {/* Gym switcher, locale, sign out */}
</header>
```

---

### 2. Sidebar Navigation
```
┌──────────────┐
│ [Logo]       │  ← Repeat logo at top for brand awareness
│  Dashboard   │
│  Members     │
│  Subscr.     │
│  Payments    │
│  Access      │
│  Reports     │
│  Settings    │
│              │
│ [User Role]  │
└──────────────┘
```

**Logo in sidebar:**
- Small version (24-32px)
- Above nav items
- Acts as "home" button on click
- Colored with primary color

---

### 3. Login Page

```
┌─────────────────────────────┐
│                             │
│       [Gym Logo Big]        │  ← 80-120px, centered
│                             │
│   GymABC Member Portal      │  ← Gym name
│                             │
│   [Email input]             │
│   [Password input]          │
│   [Sign In button]          │
│                             │
└─────────────────────────────┘
```

**Login page design:**
- Hero section with large logo
- Gym name dynamically loaded from database
- Color scheme from gym branding
- Simplified, focused interface
- Mobile-responsive

```tsx
// apps/admin/src/app/sign-in/page.tsx (updated)
export default async function SignInPage() {
  const context = await getCurrentGym(); // Query gym branding
  
  return (
    <div className="flex min-h-screen items-center justify-center" 
         style={{ background: `linear-gradient(135deg, ${context.primaryColor} 0%, ${context.accentColor} 100%)` }}>
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        {context.logoUrl && (
          <img src={context.logoUrl} alt="Gym" className="mx-auto mb-6 h-20 w-20" />
        )}
        <h1 className="mb-2 text-center text-2xl font-bold">{context.gymName}</h1>
        <p className="mb-6 text-center text-muted">Member Portal</p>
        
        {/* Sign-in form */}
      </div>
    </div>
  );
}
```

---

## Feature Screens

### A. Dashboard (Role-Specific)

#### Manager Dashboard
```
┌─────────────────────────────────────────────────┐
│  Dashboard                        GymABC         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ Active       │ │ Revenue      │            │
│  │ Members      │ │ This Month   │            │
│  │ 247          │ │ Rs 98,500    │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ Overdue      │ │ Occupancy    │            │
│  │ Invoices     │ │ Right Now    │            │
│  │ 12           │ │ 34/50        │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  Recent Activity                               │
│  ─────────────────────────────────────────    │
│  Payment: Rs 5,000 (Peter) → 2 min ago        │
│  New: Alice joined (Family) → 15 min ago      │
│  Invoice: Due soon for 5 members              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Design notes:**
- 4-card KPI summary (primary color accents)
- Quick-access buttons below (New Member, Record Payment, Check In)
- Activity feed (recent actions)
- Color-coded status (green=good, amber=warning, red=critical)

#### Staff Dashboard
```
┌─────────────────────────────────────────────────┐
│  Dashboard                        GymABC         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ Today's      │ │ Occupancy    │            │
│  │ Members      │ │ Right Now    │            │
│  │ 156          │ │ 34/50        │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  Quick Actions                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ Check In     │ │ New Member   │            │
│  │ Member       │ │ Registration │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  Live Entry Log (Last 10)                      │
│  ─────────────────────────────────────────    │
│  ✓ Alice in (11:23, Lunch access)             │
│  ✓ Bob in (11:21, Full access)                │
│  ✗ Carol denied (14:58, Outside hours)        │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Accountant Dashboard
```
┌─────────────────────────────────────────────────┐
│  Dashboard                        GymABC         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ Total        │ │ Outstanding  │            │
│  │ Revenue      │ │ Invoices     │            │
│  │ Rs 742,500   │ │ Rs 45,200    │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ Cash Var.    │ │ Reconciled   │            │
│  │ This Month   │ │ Payments     │            │
│  │ Rs 250 over  │ │ 98.2%        │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  Reports (Read-only exports)                   │
│  • Revenue by plan                             │
│  • VAT summary                                 │
│  • Payment method breakdown                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### B. Member Management

#### Member List
```
┌─────────────────────────────────────────────────┐
│ Members                    [+ New]  [Import]    │
├─────────────────────────────────────────────────┤
│ Search: [______________]  Status: [All▼]       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Alice (ID: MEM-0001)                           │
│ alice@example.com • 231-4567                   │
│ Family (3 members) • Active • Joined 6m ago    │
│ [View] [Edit] [→]                              │
│                                                 │
│ Bob (ID: MEM-0002)                             │
│ bob@example.com • 231-5678                     │
│ Full • Active • Joined 3m ago                  │
│ [View] [Edit] [→]                              │
│                                                 │
│ Carol (ID: MEM-0003)                           │
│ carol@example.com • 231-6789                   │
│ Lunch • ⚠ Overdue since 2 days                 │
│ [View] [Edit] [→]                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Design notes:**
- Large touch targets (staff on tablets)
- Name + code prominent
- Status badges (color-coded: green=active, amber=on hold, red=suspended)
- Quick actions (swipe or buttons)
- Filter by status/plan

#### Member Detail
```
┌─────────────────────────────────────────────────┐
│ Alice Johnson (MEM-0001)        [Edit] [More]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Photo]                                        │
│ Age 28 • alice@example.com • 231-4567         │
│ Joined: March 15, 2026                         │
│                                                 │
│ Household: Johnson Family                      │
│ • Alice (Primary) • Bob (Spouse) • Carol (Child)
│                                                 │
│ Active Subscription                            │
│ Plan: Family • Rs 3,500/month                  │
│ Started: Jun 1 • Renews: Sep 1                │
│ Status: ✓ Active                               │
│                                                 │
│ Payment Standing                               │
│ Current Invoice (Due: Aug 20): Rs 3,500 ✓ Paid │
│ Next Invoice (Due: Sep 20): Rs 3,500 ⚠ Due 8d  │
│                                                 │
│ Access                                         │
│ Last Entry: 14:32 today (Lunch access)        │
│ Today's Entries: 1 (11:23-14:47, 3h 24m)      │
│ [View Full Log]                                │
│                                                 │
│ Actions                                        │
│ [Pause] [Issue Guest Pass] [Create Invoice]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### C. Payment Recording (Critical UX)

#### Check-in Member → Record Payment Flow

**1. Member Search** (Fast, minimal typing)
```
┌─────────────────────────────────────────────────┐
│ Check In                                   [?]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Scan NFC / QR or search:                       │
│ [_________________________]  🔍                 │
│                                                 │
│ Recent Members:                                │
│ • Alice (6 times today)                       │
│ • Bob (3 times today)                         │
│ • Carol (Due today)                           │
│                                                 │
└─────────────────────────────────────────────────┘
```

**2. Member Lookup Result** (Big, clear decision)
```
┌─────────────────────────────────────────────────┐
│                                                 │
│          [Large Photo]                         │
│                                                 │
│          Alice Johnson                         │
│          Family Member                         │
│                                                 │
│          ✓ GRANTED                             │
│          Lunch access (11:30-15:00)            │
│          Plan expires in 18 days               │
│                                                 │
│          [Check In]  [Details]  [Cancel]       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**3. Record Payment**
```
┌─────────────────────────────────────────────────┐
│ Record Payment                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ For: Alice Johnson (Family)                    │
│ Due: Rs 3,500 (Due Sep 20)                     │
│                                                 │
│ Amount:                                        │
│ [___________________] Rs                       │
│                                                 │
│ Method:                                        │
│ ○ Cash        ● Card        ○ Transfer        │
│                                                 │
│ Till Shift:                                    │
│ [Open shift dropdown]  [Help]                  │
│                                                 │
│ Reference (optional):                          │
│ [_____________________]                        │
│                                                 │
│ [Save Payment] [Cancel]                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**4. Confirmation**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ✓ Payment Recorded                           │
│                                                 │
│   Rs 3,500 from Alice Johnson                  │
│   Invoice: INV-2026-00456                      │
│   Paid via Card on 12 Aug 2026 at 14:32       │
│                                                 │
│   [New Payment] [Done]                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### D. Access Control Interface

#### Live Occupancy Dashboard
```
┌─────────────────────────────────────────────────┐
│ Access Control                   Last 1 min     │
├─────────────────────────────────────────────────┤
│                                                 │
│ Occupancy: 34/50 (68%)  ████████░  Gym        │
│            12/20 (60%)  ██████░    Pool       │
│                                                 │
│ Recent Entries (Last 30 min):                  │
│                                                 │
│ 14:32  ✓  Alice  Lunch access (in 3h 24m)    │
│ 14:21  ✓  Bob    Full access (in 4h 12m)     │
│ 14:15  ✗  Carol  DENIED • Outside hours      │
│            (Lunch access 11:30-15:00)         │
│ 14:08  ✓  Dave   Full access (in 2h 56m)     │
│ 14:02  ✗  Eve    DENIED • Account suspended   │
│                                                 │
│ [View Full Log]  [Export Report]               │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Color coding:**
- ✓ Green = Granted
- ✗ Red = Denied
- ⚠ Amber = Override (manual entry)

---

## Component Design Specs

### Button Styles
```
Primary (Action buttons):
  Background: {primaryColor}
  Text: White
  Hover: darker shade
  
Secondary (Cancel, edit):
  Background: Transparent
  Border: {primaryColor}
  Text: {primaryColor}
  
Danger (Delete, suspend):
  Background: #D62828
  Text: White
  
Success (Confirm, granted):
  Background: #06A77D
  Text: White
  
Warning (Overdue, on hold):
  Background: #F77F00
  Text: White
```

### Status Badges
```
Active:       🟢 Green background, white text
Inactive:     ⚫ Gray background, white text
On Hold:      🟠 Amber background, white text
Overdue:      🔴 Red background, white text
Suspended:    ⚫ Dark red background, white text
Granted:      ✓ Green checkmark
Denied:       ✗ Red X
```

### Card Components
```
KPI Card:
  ┌─────────────────┐
  │ Title (12px)    │
  │                 │
  │ 247             │  ← Large number
  │ Active Members  │  ← Subtext
  │                 │
  │ ↑ 12% vs last   │  ← Trend
  └─────────────────┘

Info Card:
  ┌─────────────────────────────┐
  │ Bob Johnson (MEM-0002)      │
  │ Full • Active               │
  │                             │
  │ Next payment: Sep 1 (Due)   │
  │ □ [View] [Edit] [...]       │
  └─────────────────────────────┘
```

---

## Responsive Breakpoints

| Screen | Size | Layout |
|--------|------|--------|
| Mobile | <640px | Single column, full-width buttons |
| Tablet | 640-1024px | Two columns, large touch targets |
| Desktop | >1024px | Three columns, sidebar fixed |

---

## Implementation Plan

### Phase 1: Branding Integration (Week 1)
- [ ] Create theme provider that loads gym branding colors
- [ ] Update CSS variables to use `--color-primary`, `--color-accent`, etc.
- [ ] Logo display in header, sidebar, login page
- [ ] Test with different color palettes

### Phase 2: Dashboard Redesign (Week 2)
- [ ] Manager dashboard with KPI cards
- [ ] Role-specific dashboard views (staff, accountant)
- [ ] Quick action buttons
- [ ] Activity feed / recent actions

### Phase 3: Member Management UI (Week 2)
- [ ] Redesigned member list (large cards, status badges)
- [ ] Member detail page with household info
- [ ] Photo display + identity verification

### Phase 4: Payment Flow (Week 3)
- [ ] Quick member search (NFC/QR support ready)
- [ ] Payment recording with visual feedback
- [ ] Till shift integration
- [ ] Success/error states

### Phase 5: Access Control UI (Week 3)
- [ ] Live occupancy display
- [ ] Entry log with clear status indicators
- [ ] Access decision reasons (human-readable)
- [ ] Manual override workflow

### Phase 6: Refinement (Week 4)
- [ ] Mobile responsiveness testing
- [ ] Accessibility audit (WCAG 2.1)
- [ ] Performance optimization
- [ ] Dark mode (if desired)

---

## Figma / Design Tool Setup (Optional)

To collaborate on design:
1. Create Figma file: `GymX - UI System`
2. Set up design tokens (colors, typography, spacing)
3. Create component library (buttons, cards, inputs)
4. Design screens for each feature
5. Export to Vercel Blob for reference

---

## Accessibility Requirements

- **WCAG 2.1 Level AA** minimum
- High contrast: 4.5:1 for text
- Touch targets: 48px minimum
- Keyboard navigation throughout
- Screen reader support
- No color-only information (always use text or icons)

---

## Dark Mode (Future)

If requested, automatically invert:
- Background: black
- Text: white
- Colors: adjusted for readability
- Logo: invert if necessary

---

## References & Inspiration

Fitness apps with strong UX:
- **Gym floor check-in:** Fast, visual, minimal typing (tablet focus)
- **Payment recording:** Confirmation before action (money is critical)
- **Occupancy dashboards:** Real-time updates, clear capacity
- **Membership dashboard:** Status at a glance (color, badges, text)

Key pattern: **High information density + Large touch targets + Color coding**
