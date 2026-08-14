'use server';

import { Time } from '@gymx/core';
import { evaluate } from '@gymx/core/access';
import { NotFoundError } from '@gymx/core/errors';
import {
  accessEvents,
  gyms,
  invoices,
  members,
  planAccessRules,
  plans,
  subscriptionMembers,
  subscriptions,
  visits,
} from '@gymx/db';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

const checkInSchema = z.object({
  memberId: z.string().uuid(),
  area: z.enum(['gym', 'pool', 'classes']).default('gym'),
  direction: z.enum(['in', 'out']).default('in'),
});

/**
 * Decide, record, and report — all on the server.
 *
 * The client sends only WHO is at the door and WHERE. It never sends the verdict.
 * recordAccessEventAction still accepts a caller-supplied result because a
 * turnstile integration may replay a decision, but nothing a member can reach is
 * allowed to assert its own entitlement: a door controller that decides locally
 * is a door controller that can be told to say yes.
 *
 * Every attempt is written to access_events, denials included. A gate that only
 * logs successes cannot answer "who got in while overdue?", which is the exact
 * question this product exists to answer.
 */
export const checkInAction = defineAction(
  checkInSchema,
  {
    permission: { action: 'create', subject: 'access_event' },
    audit: { entity: 'access_event', action: 'check_in' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const now = new Date();

    const [member] = await db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        memberSeq: members.memberSeq,
        status: members.status,
        photoUrl: members.photoUrl,
      })
      .from(members)
      .where(eq(members.id, input.memberId))
      .limit(1);
    if (!member) throw new NotFoundError('Member not found');

    const [gym] = await db
      .select({ timezone: gyms.timezone, graceDays: gyms.overdueGraceDays })
      .from(gyms)
      .where(eq(gyms.id, gymId))
      .limit(1);
    const timeZone = gym?.timezone ?? 'Indian/Mauritius';
    const graceDays = gym?.graceDays ?? 0;

    // Subscriptions covering this member, with their plans' access rules.
    const covering = await db
      .select({
        subscriptionId: subscriptions.id,
        status: subscriptions.status,
        startsOn: subscriptions.startsOn,
        endsOn: subscriptions.endsOn,
        planId: plans.id,
        planNameI18n: plans.nameI18n,
      })
      .from(subscriptionMembers)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionMembers.subscriptionId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptionMembers.memberId, input.memberId));

    const activeSubs = covering.filter((s) => s.status === 'active');
    const planIds = activeSubs.map((s) => s.planId);

    const rules = planIds.length
      ? await db
          .select({
            planId: planAccessRules.planId,
            area: planAccessRules.area,
            weekdays: planAccessRules.weekdays,
            startTime: planAccessRules.startTime,
            endTime: planAccessRules.endTime,
          })
          .from(planAccessRules)
          .where(sql`${planAccessRules.planId} in ${planIds}`)
      : [];

    // Overdue past the gym's grace period, in the gym's own timezone.
    const cutoff = Time.dateKeyInZone(Time.addDaysInZone(now, -graceDays, timeZone), timeZone);
    const [overdue] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(invoices)
      .where(
        and(
          eq(invoices.payerMemberId, input.memberId),
          sql`${invoices.dueOn} < ${cutoff}`,
          ne(invoices.status, 'paid'),
          ne(invoices.status, 'void'),
          ne(invoices.status, 'written_off'),
        ),
      );
    const overdueCount = overdue?.n ?? 0;

    const decision = await evaluate(
      { memberId: member.id, status: member.status },
      input.area,
      now,
      timeZone,
      {
        isActive: (at) => {
          const key = Time.dateKeyInZone(at, timeZone);
          return activeSubs.some((s) => s.startsOn <= key && (!s.endsOn || key <= s.endsOn));
        },
        isAllowedByPlanRules: (area, at, tz) =>
          rules
            .filter((r) => r.area === area)
            .some((r) => {
              // A rule with no weekdays and no times is "any day, all day".
              if (!r.startTime && !r.endTime) {
                return !r.weekdays || r.weekdays.includes(Time.weekdayInZone(at, tz));
              }
              const days = r.weekdays ?? [0, 1, 2, 3, 4, 5, 6];
              return days.some((day) =>
                Time.isWithinWindow(
                  at,
                  tz,
                  Time.timeWindow(
                    day as Time.Weekday,
                    r.startTime ?? '00:00',
                    r.endTime ?? '24:00',
                  ),
                ),
              );
            }),
        isOverdue: () => overdueCount > 0,
      },
    );

    await db.insert(accessEvents).values({
      gymId,
      memberId: member.id,
      enteredAt: now,
      direction: input.direction,
      method: 'manual',
      area: input.area,
      result: decision.result,
      reasonCode: decision.reasonCode,
    });

    // Occupancy: open a visit on a granted entry, close the open one on exit.
    if (decision.result === 'granted') {
      if (input.direction === 'in') {
        await db.insert(visits).values({ gymId, memberId: member.id, enteredAt: now });
      } else {
        const [open] = await db
          .select({ id: visits.id, enteredAt: visits.enteredAt })
          .from(visits)
          .where(and(eq(visits.memberId, member.id), isNull(visits.exitedAt)))
          .orderBy(sql`${visits.enteredAt} desc`)
          .limit(1);

        if (open) {
          await db
            .update(visits)
            .set({
              exitedAt: now,
              dwellMinutes: Math.max(
                0,
                Math.floor((now.getTime() - open.enteredAt.getTime()) / 60_000),
              ),
            })
            .where(eq(visits.id, open.id));
        }
      }
    }

    const [occupancy] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(visits)
      .where(isNull(visits.exitedAt));

    revalidatePath('/access');
    revalidatePath('/');

    return {
      result: decision.result,
      reasonCode: decision.reasonCode,
      memberName: `${member.firstName} ${member.lastName}`,
      memberSeq: member.memberSeq,
      photoUrl: member.photoUrl,
      occupancy: occupancy?.n ?? 0,
    };
  },
);
