import {
  householdMembers,
  households,
  members,
  plans,
  subscriptionMembers,
  subscriptions,
} from '@gymx/db';
import type { Locale } from '@gymx/i18n';
import { Content } from '@gymx/i18n';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { queryInGym } from '../../../lib/action';
import type { MemberRow } from '../../../lib/member-grouping';

export const MEMBER_STATUSES = ['active', 'frozen', 'suspended', 'inactive'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/**
 * Rendered ceiling. Offset pagination would split a family across a page
 * boundary, and paginating by group is real machinery for a tenant of ~1000
 * members — so we cap, detect the cap, and tell the user to narrow instead.
 */
export const PAGE_LIMIT = 500;

export interface MembersQueryResult {
  rows: MemberRow[];
  statusCounts: Record<MemberStatus, number>;
  total: number;
  truncated: boolean;
}

export interface MembersQueryOptions {
  q?: string;
  status?: MemberStatus;
  locale: Locale;
  /** False when the actor may not read households — see the accountant note. */
  includeFamilies: boolean;
  /** False when the actor may not read subscriptions. */
  includePlans: boolean;
}

export function isMemberStatus(value: string | undefined): value is MemberStatus {
  return !!value && (MEMBER_STATUSES as readonly string[]).includes(value);
}

/**
 * One tenant transaction, three statements.
 *
 * The two row_number() subqueries pick exactly one household and one
 * subscription per member, so the outer LEFT JOINs cannot fan a member out into
 * duplicate rows. household_members' primary key is (household_id, member_id),
 * which does not stop a member belonging to two families — without the guard
 * that would silently double them in the list.
 */
export async function fetchMembersView(options: MembersQueryOptions): Promise<MembersQueryResult> {
  return queryInGym({ action: 'read', subject: 'member' }, async (db) => {
    const conditions = [];
    if (options.status) {
      conditions.push(eq(members.status, options.status));
    }
    if (options.q) {
      const like = `%${options.q}%`;
      conditions.push(
        or(
          ilike(members.firstName, like),
          ilike(members.lastName, like),
          ilike(members.email, like),
          ilike(members.phone, like),
        ),
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const famPick = db
      .select({
        memberId: householdMembers.memberId,
        relationship: householdMembers.relationship,
        householdId: households.id,
        householdName: households.name,
        payerMemberId: households.payerMemberId,
        // Distinct alias per subquery: two columns both named "rn" in the same
        // statement are ambiguous to Postgres even across different subqueries.
        rn: sql<number>`row_number() over (
          partition by ${householdMembers.memberId}
          order by ${households.name}, ${households.id}
        )`.as('fam_rn'),
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .as('fam_pick');

    const subPick = db
      .select({
        memberId: subscriptionMembers.memberId,
        subscriptionId: subscriptions.id,
        subscriptionStatus: subscriptions.status,
        priceCents: subscriptions.priceCentsSnapshot,
        planNameI18n: plans.nameI18n,
        rn: sql<number>`row_number() over (
          partition by ${subscriptionMembers.memberId}
          order by case ${subscriptions.status}
                     when 'active' then 0
                     when 'frozen' then 1
                     when 'suspended' then 2
                     when 'expired' then 3
                     else 4 end,
                   ${subscriptions.startsOn} desc
        )`.as('sub_rn'),
      })
      .from(subscriptionMembers)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionMembers.subscriptionId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .as('sub_pick');

    // One query shape regardless of permission. The joins always run — RLS has
    // already scoped every row to this gym — and the columns the actor may not
    // see are blanked below, before anything is returned. Branching the SELECT
    // instead produced two incompatible result types for no security gain,
    // since none of this data reaches the browser either way.
    const rawRows = await db
      .select({
        id: members.id,
        memberSeq: members.memberSeq,
        firstName: members.firstName,
        lastName: members.lastName,
        email: members.email,
        phone: members.phone,
        status: members.status,
        joinedAt: members.joinedAt,
        photoUrl: members.photoUrl,
        householdId: famPick.householdId,
        householdName: famPick.householdName,
        householdPayerMemberId: famPick.payerMemberId,
        relationship: famPick.relationship,
        subscriptionId: subPick.subscriptionId,
        subscriptionStatus: subPick.subscriptionStatus,
        priceCents: subPick.priceCents,
        planNameI18n: subPick.planNameI18n,
      })
      .from(members)
      .leftJoin(famPick, and(eq(famPick.memberId, members.id), eq(famPick.rn, 1)))
      .leftJoin(subPick, and(eq(subPick.memberId, members.id), eq(subPick.rn, 1)))
      .where(where)
      .orderBy(
        // Families and solo members interleave alphabetically, while a family's
        // own members stay adjacent and lead with the primary.
        sql`lower(coalesce(${famPick.householdName}, ${members.lastName} || ' ' || ${members.firstName}))`,
        sql`case ${famPick.relationship}
              when 'primary' then 0 when 'spouse' then 1 when 'child' then 2 else 3 end`,
        asc(members.lastName),
        asc(members.firstName),
      )
      .limit(PAGE_LIMIT + 1);

    const statusRows = await db
      .select({ status: members.status, n: sql<number>`count(*)::int` })
      .from(members)
      .groupBy(members.status);

    const statusCounts = { active: 0, frozen: 0, suspended: 0, inactive: 0 } as Record<
      MemberStatus,
      number
    >;
    let total = 0;
    for (const r of statusRows) {
      statusCounts[r.status] = r.n;
      total += r.n;
    }

    const truncated = rawRows.length > PAGE_LIMIT;
    const rows: MemberRow[] = rawRows.slice(0, PAGE_LIMIT).map((r) => ({
      id: r.id,
      memberSeq: r.memberSeq,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      status: r.status,
      joinedAt: r.joinedAt,
      photoUrl: r.photoUrl,
      householdId: options.includeFamilies ? r.householdId : null,
      householdName: options.includeFamilies ? r.householdName : null,
      householdPayerMemberId: options.includeFamilies ? r.householdPayerMemberId : null,
      relationship: options.includeFamilies ? r.relationship : null,
      subscriptionId: options.includePlans ? r.subscriptionId : null,
      subscriptionStatus: options.includePlans ? r.subscriptionStatus : null,
      priceCents: options.includePlans && r.priceCents !== null ? Number(r.priceCents) : null,
      // Resolved server-side so the client never receives a translation blob.
      // Content.text defaults to an empty placeholder, which would render as a
      // blank cell — pass one explicitly.
      planName:
        options.includePlans && r.planNameI18n
          ? Content.text(r.planNameI18n, options.locale, { placeholder: '—' })
          : null,
    }));

    return { rows, statusCounts, total, truncated };
  });
}
