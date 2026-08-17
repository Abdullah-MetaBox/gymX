import { Money, Time } from '@gymx/core';
import { can } from '@gymx/core/auth';
import { payments, tills, tillShifts, users } from '@gymx/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';
import { CashDrawerControls } from './cash-drawer-controls';

/**
 * Cash drawer sessions.
 *
 * The point of this screen is the variance column: a drawer that does not
 * balance produces a permanent, attributed record rather than a shrug at month
 * end. Cash cannot be taken without an open shift, so there is no path for money
 * to arrive without landing here.
 */
export default async function TillShiftsPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'till_shift');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('tillShifts.title')} subtitle={t('tillShifts.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} />
      </>
    );
  }

  const { tillRows, shiftRows, openShift } = await queryInGym(
    { action: 'read', subject: 'till_shift' },
    async (db) => {
      const tillRows = await db
        .select({ id: tills.id, name: tills.name })
        .from(tills)
        .orderBy(tills.name);

      // Running total per shift, so an open drawer shows what it *should* hold
      // before anyone counts it.
      const takings = db
        .select({
          tillShiftId: payments.tillShiftId,
          total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.as('taken'),
        })
        .from(payments)
        .groupBy(payments.tillShiftId)
        .as('takings');

      const shiftRows = await db
        .select({
          id: tillShifts.id,
          tillName: tills.name,
          status: tillShifts.status,
          openedAt: tillShifts.openedAt,
          closedAt: tillShifts.closedAt,
          openingFloatCents: tillShifts.openingFloatCents,
          countedCents: tillShifts.countedCents,
          expectedCents: tillShifts.expectedCents,
          varianceCents: tillShifts.varianceCents,
          notes: tillShifts.notes,
          openedByName: users.name,
          takenCents: takings.total,
        })
        .from(tillShifts)
        .innerJoin(tills, eq(tills.id, tillShifts.tillId))
        .leftJoin(users, eq(users.id, tillShifts.openedBy))
        .leftJoin(takings, eq(takings.tillShiftId, tillShifts.id))
        .orderBy(desc(tillShifts.openedAt))
        .limit(50);

      const [open] = await db
        .select({ id: tillShifts.id, tillName: tills.name })
        .from(tillShifts)
        .innerJoin(tills, eq(tills.id, tillShifts.tillId))
        .where(and(eq(tillShifts.status, 'open')))
        .limit(1);

      return { tillRows, shiftRows, openShift: open ?? null };
    },
  );

  const mur = (cents: number | null) =>
    cents === null ? '—' : Money.format(Money.cents(Number(cents)), { currency: 'MUR' });

  const canOperate = can(context.actor.role, 'create', 'till_shift');

  return (
    <>
      <PageHeader title={t('tillShifts.title')} subtitle={t('tillShifts.subtitle')} />

      {canOperate ? (
        <div className="mb-5">
          <CashDrawerControls
            tills={tillRows}
            openShift={openShift}
            expectedCents={
              openShift
                ? Number(
                    shiftRows.find((s) => s.id === openShift.id)?.openingFloatCents ?? 0,
                  ) + Number(shiftRows.find((s) => s.id === openShift.id)?.takenCents ?? 0)
                : 0
            }
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('tillShifts.recent')}</CardTitle>
        </CardHeader>
        {shiftRows.length === 0 ? (
          <CardBody>
            <p className="text-muted text-sm">{t('tillShifts.empty')}</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('tillShifts.till')}</Th>
                <Th>{t('tillShifts.openedBy')}</Th>
                <Th>{t('tillShifts.opened')}</Th>
                <Th className="text-right">{t('tillShifts.float')}</Th>
                <Th className="text-right">{t('tillShifts.taken')}</Th>
                <Th className="text-right">{t('tillShifts.counted')}</Th>
                <Th className="text-right">{t('tillShifts.variance')}</Th>
                <Th>{t('members.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {shiftRows.map((shift) => {
                const variance = shift.varianceCents === null ? null : Number(shift.varianceCents);
                return (
                  <tr key={shift.id} className="hover:surface-2">
                    <Td className="font-medium">{shift.tillName}</Td>
                    <Td className="text-muted text-xs">{shift.openedByName ?? '—'}</Td>
                    <Td className="text-muted text-xs">
                      {Time.formatInstant(shift.openedAt, {
                        timeZone: context.timeZone,
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </Td>
                    <Td className="text-right tabular-nums">{mur(shift.openingFloatCents)}</Td>
                    <Td className="text-right tabular-nums">{mur(shift.takenCents ?? 0)}</Td>
                    <Td className="text-right tabular-nums">{mur(shift.countedCents)}</Td>
                    <Td className="text-right tabular-nums">
                      {variance === null ? (
                        '—'
                      ) : variance === 0 ? (
                        <Badge tone="success">{t('tillShifts.balanced')}</Badge>
                      ) : (
                        <Badge tone="danger">
                          {variance > 0 ? '+' : ''}
                          {mur(variance)}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={shift.status === 'open' ? 'primary' : 'neutral'}>
                        {t(`tillShifts.statuses.${shift.status}`)}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
