# GymX Demo Guide

## Seeded Test Accounts

All accounts use password: `GymX!dev2026`

### By Role

#### 1. Platform Admin (Metabox staff)
- **Email:** `admin@metabox.test`
- **Gym:** None (must `assumeGym()` to enter a gym)
- **Power:** Full system access — create gyms, manage users, audit log

**Demo walkthrough:**
1. Sign in as admin@metabox.test
2. Note: No dashboard yet (admin sees the platform console)
3. Click the gym switcher (top-left, shows "Platform")
4. Click "Assume Gym" next to "Gym ABC" — this is how admin enters tenant data
5. Notice the audit log now shows `admin@metabox.test assumeGym("Gym ABC")` (cross-tenant access is tracked)
6. Return to platform → try the other gym (Northside)

**Key talking points:**
- Metabox owns the platform; client data is isolated by law
- Every cross-tenant action is audited (compliance requirement)
- The gym switcher is the only way admin accesses gym data

---

#### 2. Gym Manager (GymABC owner/operator)
- **Email:** `manager@gymabc.test`
- **Gym:** Gym ABC
- **Power:** Everything inside their gym — members, plans, billing, access, staff management

**Demo walkthrough:**
1. Sign in as manager@gymabc.test
2. Lands directly on dashboard (sees their gym by default)
3. Left sidebar shows: Members, Plans, Subscriptions, Payments, Access, Reports
4. Walk through each section:
   - **Members:** 5 seeded members, create new, import CSV
   - **Plans:** Lunch, Full, Student plans with pricing
   - **Subscriptions:** Active subscriptions with invoices
   - **Payments:** Cash payments, allocations, till shifts
   - **Access:** Entry/exit log, occupancy
   - **Settings:** Gym name, colors, branding, VAT rate, minimum contract
5. Show staff management (can add team)

**Key talking points:**
- Full control of their own gym data
- Multi-location support (locations dropdown if available)
- All revenue and member data visible
- Cannot create/delete the gym itself (prevents accidents)

---

#### 3. Staff / Front Desk
- **Email:** `desk@gymabc.test`
- **Gym:** Gym ABC
- **Power:** Day-to-day operations — members, subscriptions, guest passes, payments, access

**Demo walkthrough:**
1. Sign in as desk@gymabc.test
2. Dashboard shows access control, members, payments only
3. **Left sidebar is much shorter** — note they can't see:
   - Plans (pricing is locked)
   - Reports or Financial data (no revenue visibility)
   - Settings (can't change the gym)
   - Till shifts or write-offs
4. Walk through what they CAN do:
   - **Members:** Search, create, update member info
   - **Subscriptions:** Check active subscriptions (read-only)
   - **Guest Passes:** Issue daily passes for visitors
   - **Payments:** Record cash/card payments
   - **Access:** See live entry/exit, occupancy

**Key talking points:**
- Front desk runs operations without touching prices
- Cannot delete members or subscriptions (append-only design)
- Financial/pricing decisions are gym manager's domain
- Limited liability — they can only hurt daily operations, not revenue

---

#### 4. Accountant (Finance/Bookkeeping)
- **Email:** `accounts@gymabc.test`
- **Gym:** Gym ABC
- **Power:** Read and export only — financial reports, reconciliation, audit trails

**Demo walkthrough:**
1. Sign in as accounts@gymabc.test
2. Dashboard shows only read-only panels
3. **Zero edit buttons anywhere** — every button is "Export" or "View"
4. Can access:
   - **Members:** Search, export to CSV
   - **Subscriptions:** View invoice history
   - **Payments:** See all payments, till reconciliation
   - **Financial Reports:** Revenue by period, VAT summary, payment method breakdown
   - **Audit Log:** Every change made by anyone (full compliance trail)
5. Try exporting a report — shows CSV with proper formatting

**Key talking points:**
- Accountant is literally read-only (policy matrix enforces it)
- No way to accidentally modify data
- Perfect for external bookkeepers or auditors
- All VAT calculations are immutable (from invoice lines, not recalculated)

---

## Feature Demo Sequence

### Part 1: Membership Basics (10 min)
1. **As manager**, go to Members
2. Show the 5 seeded members (Peter, Alice, etc.)
3. Click one → view household (e.g., family)
4. Show subscription tied to that household
5. Show "Create Member" → form validation, automatic subscription if plan selected
6. **Create a new member** (won't save, but show the flow)

### Part 2: Billing (15 min)
1. **As manager**, go to Subscriptions
2. Pick an active subscription → show invoice history
3. Click an invoice → show:
   - Invoice number (MRA-compliant format)
   - Subscription line item with VAT
   - Payment allocation summary
   - Manual allocation entry if invoice is not fully paid
4. Go to Payments
5. Show a recorded payment with its till shift (cash variance control)
6. Show payment allocated to multiple invoices (VAT integrity)

### Part 3: Access & Operations (10 min)
1. **As staff**, go to Access Events
2. Show live entry/exit log with member names and reasons
3. Show occupancy count
4. Explain access rules: which plans grant which times/areas

### Part 4: Multi-Role Permissions (5 min)
1. **As accountant**, try navigating
2. Show the read-only interfaces
3. Try to click an "Edit" button (none exist)
4. Export a report to show data access without data change

### Part 5: Cross-Tenant Isolation (5 min)
1. **As admin**, assume Gym ABC
2. Open the members list
3. Assume Gym Northside (in a separate tab/window)
4. Show members are different
5. Explain RLS: app role has no direct access, policies grant per-gym visibility

---

## Common Q&A for GymABC

**Q: Can I create a new plan?**
→ Yes, as a gym manager. Go to Plans → Create. Pricing tiers, access rules all configurable.

**Q: What if a member is overdue on payment?**
→ Phase 6 (later). Currently you record it, see it in reports. Access control based on overdue status comes with Phase 5.

**Q: Can I export member data?**
→ Accountant can export from Members. Manager can too. Staff cannot.

**Q: Who can delete a member?**
→ Only gym manager. Designed that way — staff can't accidentally lose data.

**Q: What's a "hold" on a subscription?**
→ Pause a membership without losing the contract. When you resume, the term extends by the hold duration.

---

## Troubleshooting During Demo

| Problem | Solution |
|---------|----------|
| "I can't see the Payments page" | Check your role. Staff sees it, but accountant is read-only. Manager sees full controls. |
| "The form won't submit" | Validation error (check red text). All fields except "Plan" are required for members. |
| "The member appears in two gyms" | Should not happen. Data is isolated. Maybe you're looking at different accounts. |
| "Gym switcher gone" | You're a staff/manager, not an admin. Switcher only shows for multi-gym roles. |

---

## Notes for Metabox

- **Phase 0 is demo-ready:** Auth, isolation, audit log all working
- **Phase 1 content is 90% done:** Members, CSV import, households — ship after demo feedback
- **Keep the demo on this branch:** Don't merge to main until client sign-off
- **GymABC deployment:** Separate instance with their branding, direct to their gym (no gym switcher for them)
