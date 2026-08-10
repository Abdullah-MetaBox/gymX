# Product map

Everything GymX is intended to do, recorded so nothing is lost between phases.
**Bold** = in the MVP cut. Plain = captured for later.

## Context

Island Breeze / "Gym ABC" (contact: Dimitri) is a Mauritian gym approaching
~1,000 members, running on basic software plus Google Sheets. Their failure mode
is documented: a VAT period showed **200 payments in the gateway vs 400 in the
system vs 600 actually taken**. The root cause is three systems — access,
membership, payments — each holding a partial truth, never reconciled. Solving
that is the product.

**GymX** is the platform Metabox owns and resells. **Gym ABC** is the pilot
tenant: same platform, its own configuration plus a thin bespoke module.

## Platform

- **Gyms as tenants: BRN, VAT number, timezone, currency, VAT rate, locales,
  branding, enabled modules, minimum contract months, overdue grace, at-risk
  threshold, invoice numbering**
- **Platform console: create gyms, toggle modules, audited `assumeGym()`**
- `location_id` present throughout; multi-site management UI later

## Members

- **Profile: name, DOB, gender, phone, email, address, NIC, emergency contact,
  member code, preferred language**
- **Photo — required, for identity verification at entry**
- **Documents with verification state: student proof, contract, PAR-Q**
- **Medical flags; DPA consent records; data export and deletion**
- **Status lifecycle: prospect → active → on hold → suspended → cancelled → expired**
- **Households: a payer plus covered members (couple, family, group)**
- **Freeze/hold with automatic term extension; at-risk detection**
- **CSV import from Google Sheets: mapping, dry run, duplicate detection**
- **Leads, trial passes, bring-a-friend guest passes**
- **NFC card/tag issuance** (card *reading* comes with the hardware phase)
- Body measurements, fitness assessments — later, member-app territory

## Plans & pricing

- **Contract vs pass (daily / weekly / monthly)**
- **Categories: solo, couple, family, group, student, lunch/off-peak, full**
- **Per-gym minimum contract duration (Gym ABC: 12 months)**
- **Dynamic bundle pricing, two models:**
  - *Flat by size* — couple Rs 1,800 (vs Rs 2,000 separately), family Rs 3,500
  - *Per-head by size* — 1 = Rs 1,000, 2 = Rs 900 ea, 3 = Rs 800 ea, 4+ = Rs 700 ea
- **Joining fee, proration, VAT-inclusive or exclusive**
- **Access entitlements: area × weekday × time window**
- Promo codes, gift vouchers, corporate accounts — later

## Subscriptions & billing

- **Lifecycle with `min_term_ends_on` and early-termination flagging**
- **Renewals, upgrades, proration; holds that extend the term**
- **Invoices with immutable line items**
- **Manual payments: cash, card, transfer, cheque, Juice**
- **Cash requires an open till shift; Z-report and signed variance at close**
- **Partial payments, allocation, credit notes, write-offs**
- **Overdue engine with configurable grace — "blocked by the next day at latest"**
- **Dunning before suspension**
- Gateway + in-app payment · bank statement import · café POS · direct debit — later

## Access control

- **Entitlement engine returning grant/deny plus a machine-readable reason**
- **Front-desk screen: search → large photo → plan badge → unmistakable verdict**
- **Entry and exit; live occupancy; dwell time**
- **Immutable log including denials; manual override with mandatory audited reason**
- Dynamic QR (regenerating per session — defeats screenshot sharing) · NFC
  readers · turnstiles · gated pool — hardware phase
- **Fingerprint biometrics are explicitly out of scope.** The Mauritius Data
  Protection Act requires express consent and a deletion right, and access
  cannot be denied for refusal. Not worth the liability.

## Reporting & compliance

- **Revenue by period / plan / method**
- **VAT summary computed from invoice lines only**
- **Reconciliation & variance — the "200 vs 400 vs 600" control**
- **Till Z-reports; Excel export for BizReg One / MRA**
- **Membership KPIs; lead funnel; footfall and occupancy**
- **Full audit log**

## Deferred: partner coaches (Phase 7)

Profiles, certifications with expiry, commercial agreements (revenue share /
chair rent / per session), availability, PT session booking, session packs sold
on member invoices, no-show rules, a scoped coach portal, monthly payout
statements.

## Deferred: facility operations (Phase 8)

Lockers with rental billed onto the member invoice; equipment inventory,
maintenance schedules and service logs; incident/accident log for insurance.

## Gym ABC's configuration

Almost all of it is data, not code:

| Meeting note said | Actually is |
|---|---|
| Lunch / Full / Student tiers | three `plans` rows |
| 11:00–13:00 lunch window | `plan_access_rules` |
| 12-month contract minimum | `gyms.min_contract_months` |
| Couple Rs 1,800 vs Rs 2,000 | `plan_price_tiers` (flat by size) |
| Family Rs 3,500 | `plan_price_tiers` (flat by size) |
| Pool as a gated area | an `area` value on the access rule |
| Access cut a day after due | `gyms.overdue_grace_days` |

Genuinely bespoke, and living in the `gym-abc` module: student-status
verification gating activation of a Student plan on an approved proof document
with annual re-verification; their MRA export column layout; hooks for the
physically gated pool.
