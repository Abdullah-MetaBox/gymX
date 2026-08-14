import { describe, expect, it } from 'vitest';
import {
  countMembers,
  type FamilyGroup,
  groupMembersByFamily,
  type MemberRow,
} from './member-grouping';

function row(overrides: Partial<MemberRow> & Pick<MemberRow, 'id'>): MemberRow {
  return {
    memberSeq: 1,
    firstName: 'Test',
    lastName: 'Member',
    email: null,
    phone: null,
    status: 'active',
    joinedAt: '2026-01-01',
    photoUrl: null,
    householdId: null,
    householdName: null,
    householdPayerMemberId: null,
    relationship: null,
    subscriptionId: null,
    subscriptionStatus: null,
    priceCents: null,
    planName: null,
    ...overrides,
  };
}

const families = (groups: ReturnType<typeof groupMembersByFamily>) =>
  groups.filter((g): g is FamilyGroup => g.kind === 'family');

describe('groupMembersByFamily', () => {
  it('returns nothing for no rows', () => {
    expect(groupMembersByFamily([])).toEqual([]);
  });

  it('leaves members without a household ungrouped', () => {
    const groups = groupMembersByFamily([row({ id: 'a' }), row({ id: 'b' })]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.kind === 'solo')).toBe(true);
  });

  it('collapses a family of four into one group', () => {
    const groups = groupMembersByFamily(
      ['a', 'b', 'c', 'd'].map((id) =>
        row({ id, householdId: 'h1', householdName: 'The Ramdhani family' }),
      ),
    );

    expect(groups).toHaveLength(1);
    expect(families(groups)[0]?.members).toHaveLength(4);
    expect(countMembers(groups)).toBe(4);
  });

  it('keeps two families with the SAME surname apart', () => {
    // Grouping on the display name would merge strangers into one household.
    const groups = groupMembersByFamily([
      row({ id: 'a', householdId: 'h1', householdName: 'The Ramdhani family' }),
      row({ id: 'b', householdId: 'h2', householdName: 'The Ramdhani family' }),
    ]);

    expect(families(groups)).toHaveLength(2);
    expect(families(groups).map((f) => f.householdId)).toEqual(['h1', 'h2']);
  });

  it('merges a family whose rows are not contiguous rather than splitting it', () => {
    const groups = groupMembersByFamily([
      row({ id: 'a', householdId: 'h1', householdName: 'Fam' }),
      row({ id: 'solo' }),
      row({ id: 'b', householdId: 'h1', householdName: 'Fam' }),
    ]);

    expect(families(groups)).toHaveLength(1);
    expect(families(groups)[0]?.members.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('counts only ACTIVE subscriptions as covered', () => {
    const groups = groupMembersByFamily([
      row({ id: 'a', householdId: 'h1', subscriptionId: 's1', subscriptionStatus: 'active' }),
      row({ id: 'b', householdId: 'h1', subscriptionId: 's1', subscriptionStatus: 'active' }),
      row({ id: 'c', householdId: 'h1', subscriptionId: 's1', subscriptionStatus: 'active' }),
      row({ id: 'd', householdId: 'h1' }),
    ]);

    const family = families(groups)[0];
    expect(family?.coveredCount).toBe(3);
    expect(family?.members).toHaveLength(4);
  });

  it('does not treat a cancelled subscription as cover', () => {
    const groups = groupMembersByFamily([
      row({ id: 'a', householdId: 'h1', subscriptionId: 's1', subscriptionStatus: 'cancelled' }),
    ]);
    expect(families(groups)[0]?.coveredCount).toBe(0);
  });

  it('reports a shared plan only when every covered member is on the same subscription', () => {
    const shared = groupMembersByFamily([
      row({
        id: 'a',
        householdId: 'h1',
        subscriptionId: 's1',
        subscriptionStatus: 'active',
        planName: 'Family Full',
        priceCents: 350_000,
      }),
      row({
        id: 'b',
        householdId: 'h1',
        subscriptionId: 's1',
        subscriptionStatus: 'active',
        planName: 'Family Full',
        priceCents: 350_000,
      }),
    ]);
    expect(families(shared)[0]?.planName).toBe('Family Full');
    expect(families(shared)[0]?.priceCents).toBe(350_000);

    const mixed = groupMembersByFamily([
      row({
        id: 'a',
        householdId: 'h1',
        subscriptionId: 's1',
        subscriptionStatus: 'active',
        planName: 'Full',
      }),
      row({
        id: 'b',
        householdId: 'h1',
        subscriptionId: 's2',
        subscriptionStatus: 'active',
        planName: 'Lunch',
      }),
    ]);
    expect(families(mixed)[0]?.planName).toBeNull();
  });

  it('preserves the order rows arrived in', () => {
    const groups = groupMembersByFamily([
      row({ id: 'solo1' }),
      row({ id: 'fam', householdId: 'h1' }),
      row({ id: 'solo2' }),
    ]);
    expect(groups.map((g) => (g.kind === 'family' ? g.householdId : g.member.id))).toEqual([
      'solo1',
      'h1',
      'solo2',
    ]);
  });
});
