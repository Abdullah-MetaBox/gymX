import { formatMemberCode, householdMembers, households, members } from '@gymx/db';
import { count, eq } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

export default async function HouseholdsPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'household');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('households.title')} subtitle={t('households.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} />
      </>
    );
  }

  const rows = await queryInGym({ action: 'read', subject: 'household' }, (db) =>
    db
      .select({
        id: households.id,
        name: households.name,
        payerFirstName: members.firstName,
        payerLastName: members.lastName,
        payerSeq: members.memberSeq,
        memberCount: count(householdMembers.memberId),
      })
      .from(households)
      .leftJoin(members, eq(members.id, households.payerMemberId))
      .leftJoin(householdMembers, eq(householdMembers.householdId, households.id))
      .groupBy(households.id, members.firstName, members.lastName, members.memberSeq)
      .orderBy(households.name)
      .limit(200),
  );

  return (
    <>
      <PageHeader
        title={t('households.title')}
        subtitle={t('households.subtitle')}
        actions={
          <Link href="/households/new">
            <Button>{t('households.create')}</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t('households.empty')}
          action={
            <Link href="/households/new">
              <Button>{t('households.create')}</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{t('households.name')}</Th>
                <Th>{t('households.payer')}</Th>
                <Th>{t('households.members')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:surface-2">
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-muted">
                    {row.payerFirstName
                      ? `${row.payerFirstName} ${row.payerLastName} (${formatMemberCode(row.payerSeq!)})`
                      : '—'}
                  </Td>
                  <Td className="text-muted">{row.memberCount}</Td>
                  <Td>
                    <Link
                      href={`/households/${row.id}`}
                      className="text-[var(--color-primary)] text-sm hover:underline underline-offset-2"
                    >
                      {t('common.view')}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
