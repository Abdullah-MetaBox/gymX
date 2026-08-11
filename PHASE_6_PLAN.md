# Phase 6 Implementation Plan: Payment Reconciliation

## Scope: Bank Statement Import + Auto-Matching

### Deliverables (4 weeks, prioritized)

#### **Week 1: Database + Schema**
- [ ] Create bank_imports table (import history)
- [ ] Create bank_transactions table (parsed line items)
- [ ] Add discount_percent + discount_reason to subscriptions
- [ ] Migration 0006 generated + applied
- [ ] RLS policies for new tables

#### **Week 2: Server Actions**
- [ ] uploadBankStatementAction (CSV parse + reference extraction)
- [ ] autoMatchPaymentsAction (batch processing)
- [ ] manuallyMatchPaymentAction (unmatched queue override)
- [ ] Tests for reference regex, allocation logic

#### **Week 3: UI Pages**
- [ ] Bank Import Dashboard (upload + history)
- [ ] Unmatched Transactions Queue (search + manual match)
- [ ] Reconciliation Report (summary + export)
- [ ] Navigation + i18n strings

#### **Week 4: Polish + Testing**
- [ ] Client UAT prep
- [ ] Edge cases (overpayment, multiple invoices, tolerances)
- [ ] Reconciliation accuracy verification
- [ ] Audit log verification

---

## Implementation Order

1. **Database Schema** (today)
2. **Migration** (today)
3. **Server Actions** (tomorrow)
4. **UI Pages** (day 3-4)
5. **Testing** (day 5)
6. **Client UAT** (week 2)

---

## Success Criteria

✅ Staff can upload bank statement in < 1 min  
✅ 95%+ auto-match via reference number  
✅ Unmatched queue resolved in < 1 hour  
✅ Reconciliation report accurate within ±100 cents  
✅ Full audit trail of manual matches  
✅ All tests passing + typecheck clean  

---

**Status**: Ready to start Phase 6
