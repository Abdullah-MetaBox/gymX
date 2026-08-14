# Test Accounts & Credentials

All seeded accounts use password: **`GymX!dev2026`**

## Platform Admin (Metabox)

| Account | Email | Gym | Access |
|---------|-------|-----|--------|
| Platform Admin | `admin@metabox.mu` | None (use `assumeGym()`) | Full system, all gyms, cross-tenant access is audited |

**Capabilities:**
- Create/edit gyms
- Manage all users
- View audit log for compliance
- `assumeGym()` to enter a gym and see tenant data (recorded in audit log)

**Demo script:**
1. Sign in
2. Click gym switcher → "Assume Gym" next to GymABC
3. Show that this action is recorded in audit log
4. Return to platform view
5. Show Northside gym (separate tenant with separate data)

---

## Gym ABC Staff (Single Gym)

### Manager
| Account | Email | Gym | Access |
|---------|-------|-----|--------|
| Gym Manager | `manager@gymabc.mu` | Gym ABC | Full control: members, plans, billing, access, reports, staff |

**Capabilities:**
- CRUD members, households, subscriptions
- Create/edit plans and pricing
- Record payments, allocate to invoices
- Open/close till shifts
- View all reports (revenue, VAT, occupancy)
- Manage staff and their roles
- Edit gym settings (branding, minimum terms, etc.)
- Export data

**Dashboard shows:**
- Quick stats: active members, revenue this month, occupancy
- Sidebar nav: Members, Plans, Subscriptions, Payments, Access, Reports, Settings

---

### Front Desk / Staff
| Account | Email | Gym | Access |
|---------|-------|-----|--------|
| Staff / Desk | `desk@gymabc.mu` | Gym ABC | Day-to-day operations: check members, create subscriptions, record payments, manage access |

**Capabilities:**
- Search members, create/update member info (cannot delete)
- View subscriptions (read-only)
- Issue guest passes for visitors
- Record cash/card/transfer payments
- Open till shift, record/allocate payments
- View access log (entry/exit)
- View occupancy

**Cannot:**
- Edit plans or pricing (locked by gym manager)
- Delete members (append-only design)
- View financial reports or VAT
- Change gym settings
- Manage users

**Dashboard shows:**
- Members, Subscriptions (read-only), Payments, Access, Reports (operational only)
- Shorter sidebar menu than manager

---

### Accountant / Finance
| Account | Email | Gym | Access |
|---------|-------|-----|--------|
| Accountant | `accounts@gymabc.mu` | Gym ABC | Read-only: audit trail, reconciliation, VAT calculation, member/payment exports |

**Capabilities:**
- View members (export to CSV)
- View subscriptions and invoices
- View payments and allocations
- View till shifts and variance
- Export financial reports (revenue, VAT, payment methods)
- Export audit log (who changed what)
- Export access log (occupancy, dwell time)

**Cannot:**
- Change anything (no edit buttons anywhere)
- Create members or subscriptions
- Record payments
- Delete records

**Dashboard shows:**
- Read-only panels for all financial/operational data
- All exports available
- Sidebar has only read actions

---

## Northside Gym Staff (Optional - for isolation demo)

| Account | Email | Gym | Access |
|---------|-------|-----|--------|
| Manager | `manager@northside.mu` | Northside | Full control of Northside only |
| Staff | `desk@northside.mu` | Northside | Day-to-day operations for Northside only |

**Demo use:** Show that manager@northside.mu cannot see GymABC's members even when browsing. Data is isolated by RLS.

---

## Quick Matrix: Who Can Do What?

| Action | Admin | Gym Manager | Staff | Accountant |
|--------|-------|-------------|-------|-----------|
| Create member | ✓ (any gym) | ✓ | ✓ | ✗ |
| Edit member | ✓ (any gym) | ✓ | ✓ | ✗ |
| Delete member | ✗ (prevent accidents) | ✗ (append-only) | ✗ | ✗ |
| Create subscription | ✓ (any gym) | ✓ | ✓ | ✗ |
| Create invoice | ✓ (any gym) | ✓ (auto) | ✓ (manual) | ✗ |
| Record payment | ✓ (any gym) | ✓ | ✓ | ✗ |
| Allocate payment | ✓ (any gym) | ✓ | ✓ | ✗ |
| Edit plan pricing | ✓ (any gym) | ✓ | ✗ | ✗ |
| Edit gym settings | ✓ | ✓ | ✗ | ✗ |
| Create till shift | ✓ (any gym) | ✓ | ✓ | ✗ |
| View reports | ✓ (any gym) | ✓ | ✓ (operational) | ✓ (financial) |
| Export data | ✓ (any gym) | ✓ | ✗ (except reports) | ✓ |
| View audit log | ✓ (any gym) | ✓ | ✗ | ✓ |
| Create gym | ✓ | ✗ | ✗ | ✗ |
| assume Gym (cross-tenant) | ✓ (audited) | ✗ | ✗ | ✗ |

---

## How to Add More Test Accounts

**Option 1: Manually in Vercel dashboard**

1. Sign in as an existing manager/staff
2. Go to Settings → Staff Management
3. Invite new user with email + role

**Option 2: Database seed (dev only)**

Edit `packages/db/src/seed.ts` and re-run:
```bash
pnpm db:reset   # caution: drops all data
pnpm db:seed
```

---

## Demo Flow

### 15-min quick demo
1. Sign in as **manager@gymabc.mu** → show dashboard, members list
2. Create a test member → show form validation
3. Sign in as **desk@gymabc.mu** → show reduced sidebar, no pricing/settings
4. Sign in as **accounts@gymabc.mu** → show read-only, export buttons

### 30-min detailed demo
1. **Admin**: Sign in, assume gym, show audit log of cross-tenant action
2. **Manager**: Create member, create subscription, show invoice, record payment, allocate
3. **Staff**: Search member, issue guest pass, view access log
4. **Accountant**: Export financial report, show VAT calculation integrity
5. **Data isolation**: Open Northside manager in another tab, show different members

### 60-min full walkthrough
Above + Phase 1 features:
- CSV import with error handling
- Household creation and member relationships
- Subscription holds (pause a membership)
- Guest pass issuing and tracking
- Access rules (time-based, area-based)
- Till variance (cash short/over)
- Write-offs and credit notes
