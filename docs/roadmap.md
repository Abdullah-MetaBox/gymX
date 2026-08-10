# Roadmap

Scope in build is the **recommended MVP cut**: Phases 0–5, a trimmed 6, and
9–10. Phases 7 (partner coaches) and 8 (facility ops) are deferred as paid
increments.

| Phase | Delivers | Done when |
|---|---|---|
| **0** ✅ | Foundations & platform | Cross-tenant isolation proven in CI |
| **1** | Members, documents, households, guest/trial passes, **CSV import** | A 1,000-row Sheets export imports cleanly, duplicates and bad rows reported |
| **2** | Plans, dynamic bundle pricing, access rules | Gym ABC's tiers and bundles expressible with no code; couple = Rs 1,800, family = Rs 3,500 |
| **3** | Subscriptions, minimum terms, freeze/hold, invoicing | A family enrols, is invoiced with VAT, holds a month, term end moves exactly one month |
| **4** | Manual payments, allocation, **till shifts & cash variance**, credit notes, write-offs | Cash can't be recorded without an open shift; a short drawer produces an unerasable variance |
| **5** | Access control: entitlement engine, entry **and exit**, occupancy | Lunch member granted 11:30, denied 15:00, denied when a day overdue — correct reason each time |
| **6′** | Transactional email, fixed dunning ladder, at-risk filter, **magic-link sign-in** | Overdue member warned on schedule, then suspended, fully traceable |
| **9** | Reports, reconciliation, VAT summary, MRA export | A period reconciles to the cent; export opens in the MRA template |
| **10** | Gym ABC module, **French translation pass**, hardening, UAT | Real plans and members run end to end in staging with the client watching |

## Deferred (paid increments)

Phase 7 partner coaches (profiles, agreements, availability, PT booking,
session packs, coach portal, payouts) · Phase 8 facility ops (lockers,
equipment maintenance, incident log) · promo codes & vouchers · SMS/WhatsApp ·
dunning rules editor · refund workflow · multi-location UI.

## Post-v1

Member mobile app · dynamic QR + NFC readers · payment gateway & in-app payment
· bank statement import (closes the reconciliation loop fully) · café POS ·
class & pool booking · door hardware · staff clock-in via the in-house HRMS ·
Zoho sync · Kreol Morisien.

---

## Infrastructure decision (taken after Phase 0)

The MVP deploys to **Neon + Vercel + Vercel Blob**, with scheduled jobs
triggered by **GitHub Actions**. Three consequences that reach into feature work:

- **No queue, so no retries.** Every scheduled job must be idempotent —
  `generate-invoices` running twice on the same night must not invoice a member
  twice. This constrains Phase 3 onward. `JobDefinition.idempotent` is required.
- **Serverless function duration is capped.** Phase 1's CSV import of ~1,000
  members cannot run as one request; it needs chunking or a job, and that should
  be designed in rather than discovered at go-live.
- **Neon free autosuspends after ~5 minutes idle.** Fine now. Not fine for
  Phase 5's check-in screen, where a member is waiting at the door — budget for
  a paid Neon plan by then.

Vercel's Hobby plan also prohibits commercial use, so the client's live system
needs a paid plan before go-live. See `docs/deployment.md`.

## Two scheduling decisions worth remembering

**Magic-link sign-in sits in Phase 6, not Phase 0.** The Phase 0 plan listed it,
but it needs an email transport that is itself a Phase 6 deliverable. Shipping a
provider wired to nothing would have been a feature in name only.

**French ships as one pass in Phase 10.** The i18n *architecture* is in place
from Phase 0 — `next-intl`, `*_i18n` JSONB columns, per-user locale, English
fallback for missing keys. Only the French *strings* are deferred. Translating
as we go spreads a 10–15% tax across every screen in every phase, where it
becomes invisible and unrecoverable; doing it once, late, costs the same and is
visible on the plan.

---

## The money-integrity design

The reason the project exists. Five schema invariants, not a report bolted on
afterwards:

1. **Invoice-first** — money owed exists as an invoice before money moves.
2. **Payments append-only** — corrections are reversal rows plus credit notes;
   every row carries `recorded_by`.
3. **Every payment explicitly allocated** — an unallocated payment is a visible
   worklist item, not lost income.
4. **Cash cannot exist outside an open till shift** — count at close, signed
   variance that can't be erased. *This is where the untracked 600 was going.*
5. **VAT computed only from invoice lines** — declaration and ledger cannot drift.

Reconciliation screen, any period: invoiced · received · unallocated ·
outstanding · cash variance · written off/refunded · **access granted while
overdue**.

---

## Open questions, by the phase that needs them

- **Phase 1** — Webcam capture at the desk, or upload only? Webcam is a small
  addition and much better for a 1,000-member onboarding push.
- **Phase 3** — Invoice numbering format for MRA (gapless per VAT entity); does
  Gym ABC have an existing sequence to continue? Can a member hold a monthly
  pass and a contract at once?
- **Phase 5** — When a family's payer goes overdue, do *all* covered members
  lose access or only the payer? Assuming all, configurable per gym.
- **Phase 6** — Which Mauritian SMS gateway, and at what per-message cost?
- **Ops** — VPS in Mauritius vs Vercel + managed Postgres. Affects worker
  deployment and file storage (S3-compatible vs local disk).
