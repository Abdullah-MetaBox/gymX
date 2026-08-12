# MVP UI/UX Implementation Checklist

## Critical Path (What Demo Needs)

### 1. Dashboard (Role-Specific) — PRIORITY 1
- [ ] **Manager Dashboard**
  - KPI cards: Active members, Revenue (this month), Overdue invoices, Occupancy
  - Quick action buttons: New member, Record payment, View reports
  - Recent activity feed (last 10 actions)
  - Time: 2-3 hours

- [ ] **Staff Dashboard**
  - Occupancy display (current occupancy + capacity)
  - Quick actions: Check-in member, New member
  - Live entry log (last 10 entries with status)
  - Time: 2-3 hours

- [ ] **Accountant Dashboard**
  - Total revenue, Outstanding invoices, Cash variance, Reconciliation rate
  - Quick links: Export revenue, Export payments, View audit log
  - Time: 1-2 hours

### 2. Members — PRIORITY 1
- [ ] **Member List Page**
  - Large card design (better for tablet/mobile)
  - Status badges (active/overdue/suspended)
  - Quick search
  - Filter by status
  - Time: 2-3 hours

- [ ] **Member Detail Page**
  - Photo + identity info
  - Household info (if in family)
  - Active subscription + renewal date
  - Payment standing (next invoice due)
  - Recent access log
  - Quick actions: Edit, Pause, Issue guest pass
  - Time: 2-3 hours

### 3. Subscriptions & Invoices — PRIORITY 1
- [ ] **Subscriptions List**
  - Plan name, household, status
  - Next invoice date
  - Quick actions: View, Pause, Renew
  - Time: 1.5 hours

- [ ] **Invoice Detail**
  - Invoice number, date, due date
  - Line items with VAT breakdown
  - Payment allocation summary
  - "Allocate payment" button
  - Time: 2 hours

### 4. Payments — PRIORITY 1
- [ ] **Payment Recording Form**
  - Large input fields (for on-site entry)
  - Member search (fast typeahead)
  - Amount + method
  - Till shift selector
  - Confirmation before save
  - Success feedback
  - Time: 2.5 hours

- [ ] **Payments List**
  - Recent payments (date, member, amount, method, till)
  - Filter by date/method
  - Time: 1 hour

### 5. Access Control — PRIORITY 1
- [ ] **Access Log**
  - Live entry/exit display
  - Status indicators (granted/denied)
  - Reason for denial (human-readable)
  - Occupancy gauge
  - Filter by time/member
  - Time: 2 hours

### 6. Plans — PRIORITY 2
- [ ] **Plans List**
  - Plan name, category, type
  - Base price + min contract
  - Number of members using plan
  - Time: 1 hour

- [ ] **Plan Detail**
  - Pricing tiers (if bundled)
  - Access rules (times + areas)
  - Edit form
  - Time: 1.5 hours

### 7. Guest Passes — PRIORITY 2
- [ ] **Issue Guest Pass Form**
  - Guest name + host member
  - Valid date
  - Confirmation
  - Time: 1 hour

- [ ] **Guest Pass List**
  - Used/unused passes
  - Time: 0.5 hours

### 8. Till Shifts — PRIORITY 2
- [ ] **Till Shift List**
  - Open/closed status
  - Opening float + expected close
  - Counted amount + variance
  - Time: 1 hour

- [ ] **Close Till Shift Form**
  - Counted cash
  - Auto-calculate variance
  - Notes for over/short
  - Confirmation
  - Time: 1.5 hours

### 9. Households — PRIORITY 2
- [ ] **Household List**
  - Household name
  - Members (payer + dependents)
  - Subscription status
  - Time: 1 hour

- [ ] **Household Detail**
  - All members with relationships
  - Add member form
  - Subscription info
  - Payment standing
  - Time: 1.5 hours

### 10. Settings — PRIORITY 3
- [ ] **Gym Settings**
  - Name, VAT, minimum contract, overdue grace
  - Primary/accent colors (already have)
  - Logo upload (already have)
  - Enabled modules
  - Time: 0.5 hours (mostly done)

### 11. Audit Log — PRIORITY 3
- [ ] **Audit Log Viewer**
  - Who changed what when
  - Entity type filter
  - Date range
  - Diff display
  - Time: 1.5 hours

### 12. Reports — PRIORITY 3
- [ ] **Basic Reports Dashboard**
  - Revenue by period
  - Revenue by plan
  - Payment methods breakdown
  - VAT summary
  - Export to CSV
  - Time: 3-4 hours

---

## Estimated Effort

| Priority | Feature | Hours | Impact |
|----------|---------|-------|--------|
| 1 | Dashboards (3 roles) | 6 | 🔴 Critical for demo |
| 1 | Members (list + detail) | 5 | 🔴 Core MVP |
| 1 | Subscriptions/Invoices | 3 | 🔴 Billing feature |
| 1 | Payments | 3.5 | 🔴 Cash flow critical |
| 1 | Access Control | 2 | 🔴 Day-to-day ops |
| 2 | Plans | 2.5 | 🟡 Important |
| 2 | Guest Passes | 1.5 | 🟡 Nice to have |
| 2 | Till Shifts | 2.5 | 🟡 Variance tracking |
| 2 | Households | 2.5 | 🟡 Family memberships |
| 3 | Settings | 0.5 | 🟠 Already have |
| 3 | Audit Log | 1.5 | 🟠 Compliance |
| 3 | Reports | 4 | 🟠 Analytics |

**Total Priority 1: ~19.5 hours** (1 week sprint)  
**Total Priority 2: ~9 hours** (Additional week)  
**Total Priority 3: ~6 hours** (Polish week)

---

## UI Components Needed

### Shared Components (Build First)
- [ ] KPI Card (for dashboards)
- [ ] Status Badge (active/overdue/suspended/granted/denied)
- [ ] Member Card (list item)
- [ ] Activity Item (timeline)
- [ ] Data Table (with sorting, filtering, pagination)
- [ ] Form Fields (with error handling)
- [ ] Empty States
- [ ] Loading States
- [ ] Toast Notifications

### Data Fetching Utilities
- [ ] `getGymStats()` → active members, revenue, overdue count, occupancy
- [ ] `getRecentActivity()` → last 10 actions
- [ ] `getLiveOccupancy()` → current occupancy + capacity
- [ ] `getAccessLog()` → last entries/exits
- [ ] `getPaymentStanding()` → next due, outstanding

---

## Mock Data for Development

For each dashboard/feature, create seed data queries:

```sql
-- Dashboard stats
SELECT 
  COUNT(DISTINCT m.id) as active_members,
  SUM(inv.total_cents) as monthly_revenue,
  COUNT(DISTINCT i.id) as overdue_invoices,
  COUNT(ae.id) as todays_entries
FROM members m
  LEFT JOIN subscriptions s ON m.id = s.payer_member_id
  LEFT JOIN invoices i ON s.id = i.payer_member_id AND i.status = 'overdue'
  LEFT JOIN invoices inv ON DATE_TRUNC('month', inv.issued_on) = DATE_TRUNC('month', NOW())
  LEFT JOIN access_events ae ON ae.subject_type = 'member' AND DATE(ae.at) = DATE(NOW())
WHERE m.gym_id = $1 AND m.status = 'active';
```

---

## Design Systems Already Built

✅ GymBranding interface (primaryColor, accentColor, logoUrl)  
✅ Status colors (success/warning/danger)  
✅ Typography + spacing tokens  
✅ Role-based nav (computed server-side)  
✅ Form validation (Zod)  
✅ Server actions (permissions checked)  

---

## Implementation Order (Recommended)

### Week 1: MVP Dashboard + Core Pages
1. **Day 1-2:** Shared components + data fetching
2. **Day 2-3:** Manager dashboard with KPI cards
3. **Day 3-4:** Members list + detail redesign
4. **Day 4-5:** Payment recording UI

### Week 2: Subscriptions + Access Control
1. **Day 1-2:** Subscriptions/invoices improved UI
2. **Day 2-3:** Access log with live occupancy
3. **Day 3-4:** Staff dashboard + activity feed
4. **Day 4-5:** Accountant dashboard

### Week 3: Plans + Households + Polish
1. **Day 1-2:** Plans + pricing UI
2. **Day 2-3:** Households + member management
3. **Day 3-4:** Till shifts + cash variance
4. **Day 4-5:** Guest passes + polish

---

## Success Criteria (Demo Ready)

✅ Dashboard shows real data (KPIs, activity)  
✅ Member list is scannable (large cards, clear status)  
✅ Payment recording is fast (< 30 seconds, clear confirmation)  
✅ Access log shows live entries with clear status  
✅ All screens mobile-friendly (tested on tablet)  
✅ Branding applied (colors + logo visible)  
✅ No 404s or missing pages in demo flow  
✅ Keyboard navigation works  
✅ All buttons have clear labels + icons  
✅ Status always color-coded (never text-only)  

---

## Next Steps

1. **Start with shared components** (2 hours)
   - KPI Card, Status Badge, Member Card, Activity Item
   
2. **Build data fetching layer** (2 hours)
   - `getGymStats()`, `getRecentActivity()`, etc.
   
3. **Redesign dashboard** (3 hours)
   - Manager, staff, accountant versions
   
4. **Improve members** (2 hours)
   - List + detail pages

This gives you a working demo in 1 week. Remaining features in week 2-3 as polish.
