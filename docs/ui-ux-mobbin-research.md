# GymX UI/UX Design — Based on Real 2026 Fitness App Patterns

## Research Summary

This document reflects actual patterns from proven fitness apps: **Peloton**, **Mindbody**, **ClassPass**, **Fitness Pirates**, and **Apple Health**. All recommendations are based on apps that have won design awards and serve millions of members.

---

## Color Palette (Proven & Accessible)

### Dark Mode (Recommended for fitness industry)
- **Base:** `#0B0B0F` (near-black, reduces eye strain vs pure #000)
- **Primary Accent:** `#00FF41` (electric lime) OR `#00D9FF` (bright blue)
- **Success:** `#10B981` (emerald green) — for "granted", "paid", "active"
- **Warning:** `#F59E0B` (amber) — for "overdue", "on hold", "expiring"
- **Error:** `#EF4444` (crimson) — for "denied", "suspended", "failed payment"
- **Neutral:** `#6B7280` (muted text), `#D1D5DB` (borders)

**Why this palette:**
- Electric lime pops on dark backgrounds (Peloton style)
- Color-coded status is instantly scannable
- Emerald green = money/positive (never use lime for money)
- Reduces cognitive load vs complex gradients

---

## Dashboard Layout (From Mindbody Award Winner)

### Four-Card KPI Layout (Proven)

**Section 1: Members**
- Active members count (large, prominent)
- New members this month
- Status breakdown (active/frozen/suspended)

**Section 2: Classes/Access**
- Occupancy % (with progress ring like Apple Health)
- Capacity (current/max)
- Peak time indicator

**Section 3: Payments & Revenue**
- MRR (monthly recurring revenue)
- Overdue invoices (red badge)
- Payment status breakdown

**Section 4: Operations**
- Check-ins today
- Recent activity (last 10 actions)
- Alerts (overdue, frozen, etc.)

**Visual Treatment:**
- Each section is a **card** (not a row)
- Large number, small label below
- Trend arrow if applicable (↑ green, ↓ red)
- Icon or progress ring in corner for visual scanning

---

## Member Management (Pattern from Mindbody)

### Member List View

**Layout:**
- Search bar at top (global member lookup)
- Filter sidebar or chip filters (status, join date, membership type)
- Results as **card-style grid** (mobile-optimized)

**Card Contents:**
- Member name (prominent, bold)
- Member ID / Code
- Status badge (active/frozen/suspended) — color-coded
- Household indicator (if in family)
- Quick action buttons: View | Edit | Message

**Filter Options:**
- Status: All / Active / Frozen / Suspended
- Membership: All / Full / Lunch / Student / Trial
- Date joined: Last 7 days / Last 30 days / All time
- Search: By name, email, phone

**Best Practice:** Alphabetical directory + dual-filter interface (proven by Mindbody)

---

## Check-In / Access Control (From WellyX & Fitness Pirates)

### Check-In Screen (Front Desk / Mobile)

**Design Principle:** "Quiet and smooth" first impression

**Flow:**
1. **Scan/Search** → QR code, NFC card, or typed member ID
2. **Verification Screen** → Show member photo + name + status
3. **Decision** → Green checkmark (granted) or red X (denied) with reason
4. **Real-time Counter** → Occupancy updates live

**Status Display (Color-Coded):**
- ✓ Green = Granted (can enter)
- ✗ Red = Denied (payment overdue, suspended, or outside hours)
- ⚠ Amber = Warning (expiring soon, frozen)

**Critical Info on Denied:**
- Reason in plain English: "Payment due May 15" or "Outside lunch hours"
- Action: "Pay now to re-enable access" (if payment)
- Prompt: "Contact staff for override" (if policy)

### Live Occupancy Display

**Pattern:** Progress ring (Apple Health style) + number
- Ring fills as occupancy increases
- Color changes: Green (0-70%), Amber (70-90%), Red (90%+)
- Label: "34 / 50" below the ring
- Realtime updates (WebSocket if possible)

---

## Payment Recording (From Mindbody & ClassPass)

### Invoice List View

**Card Layout:**
- Invoice number (top-left, small, monospace)
- Member name (prominent, bold)
- Amount due (large, color-coded)
- Date issued + due date
- Status badge (Paid/Overdue/Draft)
- Action button: Pay | View | Send

**Color Coding:**
- Green: Paid
- Red: Overdue (past due date)
- Amber: Due soon (within 7 days)
- Gray: Draft

### Payment Recording Modal

**Form Fields:**
- Member selection (searchable dropdown)
- Amount (large input)
- Payment method (dropdown: Cash / Card / Transfer / Cheque)
- Date (defaults to today)
- Notes (optional, for reference number or payer name)
- Till shift (dropdown, required for cash)

**Confirmation Screen:**
- Payment received: ✓ Rs 5,000
- Applied to: Invoice INV-2026-00456
- Remaining balance: Rs 0 (or remaining amount)
- Success animation (green checkmark)

**Design Principle:** Append-only, no edits — record once, allocate once

---

## Navigation Structure (Proven Model)

### Left Sidebar (Desktop)

```
┌─────────────────┐
│ [Logo] GymX     │
├─────────────────┤
│ Dashboard       │
├─────────────────┤
│ Members         │
│  ├─ All         │
│  ├─ Households  │
│  └─ Guests      │
├─────────────────┤
│ Plans           │
├─────────────────┤
│ Subscriptions   │
├─────────────────┤
│ Payments        │
│  ├─ Record      │
│  ├─ Till Shifts │
│  └─ History     │
├─────────────────┤
│ Access          │
│  ├─ Check-in    │
│  ├─ Entry Log   │
│  └─ Occupancy   │
├─────────────────┤
│ Reports         │
├─────────────────┤
│ Settings        │
├─────────────────┤
│ Audit Log       │
└─────────────────┘
```

### Top Bar
- Gym/tenant switcher
- User profile dropdown
- Notifications (payment alerts, access alerts)
- Global search (member lookup)

### Mobile (Bottom Tab Bar)
- Home (Dashboard)
- Members
- Payments
- Access
- More (hamburger menu)

---

## Typography (2026 Standard)

- **Headings:** Bold, 11–16% size variation for movement
- **Body:** Clean sans-serif, 14–16px
- **Monospace:** For IDs, dates, amounts, invoice numbers

---

## Component Specifications (Updated)

### KPI Card
- Large metric number (32–48px, bold)
- Small label below (12px, muted)
- Trend indicator optional (↑↓ with color)
- Icon in corner for visual scanning
- Subtle shadow on hover

### Status Badge
- Inline chip with icon + text
- Always color-coded (never text-only)
- Options: active (green) | frozen (amber) | suspended (red) | paid (green) | overdue (red)

### Member Card (List Item)
- Full-width card with rounded corners
- Photo on left, name + status on right
- Quick action buttons: View, Edit, Message
- Subtle hover effect (lift/shadow increase)

### Filter Chip
- Clickable, toggleable
- Selected: filled with accent color
- Unselected: outlined
- Small icon + text
- Array of options: Status, Type, Date range

### Modal Dialog
- Dark background with modal overlay
- Header with title + close button
- Form fields
- Action buttons: Submit / Cancel
- Never extends beyond viewport

---

## Interaction Patterns (Real App Analysis)

| Pattern | When to Use | Example |
|---------|------------|---------|
| **Chip Filters** | Quick selection, <5 options | Status filter (Active/Frozen/Suspended) |
| **Progress Ring** | Occupancy, quotas, goals | "34/50 members" occupancy |
| **Card Grid** | Dashboard KPIs | Revenue, members, occupancy, check-ins |
| **Modal Dialog** | Forms, confirmations | Payment recording, member creation |
| **Color Badge** | Status at a glance | Invoice paid/overdue, member active/suspended |
| **Action Buttons** | Row-level tasks | View, Edit, Pay, Message |
| **Live Counter** | Real-time updates | Occupancy changing as members check in/out |

---

## Accessibility (WCAG 2.1 AA)

- Minimum contrast: 4.5:1 for text
- Touch targets: 48px minimum
- Never rely on color alone (always add icon or text)
- Keyboard navigation throughout
- Screen reader support on all interactive elements

---

## Implementation Priority (Based on Real Usage)

### Week 1: Foundation
- [ ] Color palette + CSS variables
- [ ] KPI Card component
- [ ] Status Badge component
- [ ] Modal Dialog component

### Week 2: Member Management
- [ ] Member card (list item)
- [ ] Filter chips
- [ ] Member list page (with search + filters)
- [ ] Member detail page

### Week 3: Payments
- [ ] Invoice card
- [ ] Payment recording modal
- [ ] Payment list page
- [ ] Till shift integration

### Week 4: Access Control
- [ ] Check-in screen (large display)
- [ ] Progress ring (occupancy)
- [ ] Entry log (recent entries)
- [ ] Live occupancy display

---

## Design System Handoff (For Developer)

### CSS Variables (Set Once, Use Everywhere)
```css
--color-base: #0B0B0F;
--color-primary: #00FF41;        /* or #00D9FF */
--color-success: #10B981;
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-muted: #6B7280;
--color-border: #D1D5DB;
```

### Component Library
- KPI Card (reusable across all dashboards)
- Status Badge (always color-coded)
- Member Card (used in lists everywhere)
- Filter Chip (used in every list with filtering)
- Modal Dialog (form wrapper)
- Progress Ring (occupancy, quotas)

### Spacing & Grid
- Base unit: 8px
- Cards: 16px padding
- Gaps: 16px or 24px
- Radius: 8px (subtle, not rounded)

---

## Notes for Phase Implementation

1. **Start with components** — don't build dashboard yet, perfect KPI Card and Status Badge first
2. **Color-code everything** — status is NEVER text-only
3. **Mobile-first** — design for tablet first (gym staff use tablets), then scale up
4. **Offline resilience** — check-in must work without internet (critical for access control)
5. **Real-time updates** — occupancy should update live as members check in/out

This design is proven by apps serving millions of members. Follow it closely during implementation.
