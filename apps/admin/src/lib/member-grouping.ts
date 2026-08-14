/**
 * Groups the merged members list into families and solo members.
 *
 * Pure on purpose: the query orders rows so that a family's members are already
 * contiguous, which makes this a single linear walk and lets it be tested
 * without a database.
 */

export interface MemberRow {
  id: string;
  memberSeq: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'frozen';
  joinedAt: string;
  photoUrl: string | null;

  householdId: string | null;
  householdName: string | null;
  householdPayerMemberId: string | null;
  relationship: string | null;

  subscriptionId: string | null;
  subscriptionStatus: 'active' | 'frozen' | 'suspended' | 'cancelled' | 'expired' | null;
  priceCents: number | null;
  planName: string | null;
}

export interface FamilyGroup {
  kind: 'family';
  householdId: string;
  householdName: string;
  payerMemberId: string | null;
  members: MemberRow[];
  /** Members holding an ACTIVE subscription. The gap is the point — see below. */
  coveredCount: number;
  /** The plan shared by the covered members, when they all share one. */
  planName: string | null;
  priceCents: number | null;
}

export interface SoloGroup {
  kind: 'solo';
  member: MemberRow;
}

export type MemberGroup = FamilyGroup | SoloGroup;

export function isCovered(row: MemberRow): boolean {
  return row.subscriptionStatus === 'active';
}

/**
 * Keyed on householdId, never on the household's name: two unrelated families
 * can share a surname, and merging them would put strangers in one group.
 *
 * Non-contiguous rows for the same household are still merged rather than split,
 * so a change to the query's ORDER BY degrades the visual grouping instead of
 * silently showing a family twice.
 */
export function groupMembersByFamily(rows: MemberRow[]): MemberGroup[] {
  const groups: MemberGroup[] = [];
  const familyIndex = new Map<string, FamilyGroup>();

  for (const row of rows) {
    if (!row.householdId) {
      groups.push({ kind: 'solo', member: row });
      continue;
    }

    const existing = familyIndex.get(row.householdId);
    if (existing) {
      existing.members.push(row);
      continue;
    }

    const family: FamilyGroup = {
      kind: 'family',
      householdId: row.householdId,
      householdName: row.householdName ?? 'Family',
      payerMemberId: row.householdPayerMemberId,
      members: [row],
      coveredCount: 0,
      planName: null,
      priceCents: null,
    };
    familyIndex.set(row.householdId, family);
    groups.push(family);
  }

  for (const family of familyIndex.values()) {
    const covered = family.members.filter(isCovered);
    family.coveredCount = covered.length;

    // Report a shared plan only when every covered member is genuinely on the
    // same subscription. Showing one member's plan as the family's would be the
    // kind of half-truth this screen exists to eliminate.
    const subscriptionIds = new Set(covered.map((m) => m.subscriptionId));
    if (subscriptionIds.size === 1 && covered[0]) {
      family.planName = covered[0].planName;
      family.priceCents = covered[0].priceCents;
    }
  }

  return groups;
}

/** Total members across every group — families are counted by their size. */
export function countMembers(groups: MemberGroup[]): number {
  return groups.reduce((n, g) => n + (g.kind === 'family' ? g.members.length : 1), 0);
}

const RELATIONSHIP_RANK: Record<string, number> = {
  primary: 0,
  spouse: 1,
  child: 2,
  other: 3,
};

export function relationshipRank(relationship: string | null): number {
  return RELATIONSHIP_RANK[relationship ?? 'other'] ?? 3;
}
