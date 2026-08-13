import { formatMemberCode, householdMembers, households, members } from '@gymx/db';
import { eq, and, notInArray, sql } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../../components/ui/index';
import { AddHouseholdMemberForm } from '../../../../components/add-household-member-form';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';
import { HouseholdActions } from './household-actions';

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const t = await getTranslations();
  await requirePageAccess('read', 'household');

  const [household, householdMemberRows, availableMembersData] = await Promise.all([
    queryInGym({ action: 'read', subject: 'household' }, (db) =>
      db
        .select({
          id: households.id,
          name: households.name,
          payerMemberId: households.payerMemberId,
          payerFirstName: members.firstName,
          payerLastName: members.lastName,
        })
        .from(households)
        .leftJoin(members, eq(members.id, households.payerMemberId))
        .where(eq(households.id, householdId))
        .limit(1)
        .then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'household' }, (db) =>
      db
        .select({
          memberId: householdMembers.memberId,
          relationship: householdMembers.relationship,
          firstName: members.firstName,
          lastName: members.lastName,
          memberSeq: members.memberSeq,
          status: members.status,
        })
        .from(householdMembers)
        .innerJoin(members, eq(members.id, householdMembers.memberId))
        .where(eq(householdMembers.householdId, householdId))
        .orderBy(members.lastName, members.firstName),
    ),
    queryInGym({ action: 'read', subject: 'member' }, async (db) => {
      // Get member IDs already in this household
      const alreadyInHousehold = await db
        .select({ id: householdMembers.memberId })
        .from(householdMembers)
        .where(eq(householdMembers.householdId, householdId));

      const alreadyInHouseholdIds = alreadyInHousehold.map((row) => row.id);

      // Get active members not in this household
      return db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          memberSeq: members.memberSeq,
        })
        .from(members)
        .where(
          and(
            eq(members.status, 'active'),
            alreadyInHouseholdIds.length > 0
              ? notInArray(members.id, alreadyInHouseholdIds)
              : sql`true`,
          ),
        )
        .orderBy(members.lastName, members.firstName);
    }),
  ]);

  if (!household) notFound();

  return (
    <>
      <PageHeader
        title={household.name}
        subtitle={
          household.payerFirstName
            ? `${t('households.payer')}: ${household.payerFirstName} ${household.payerLastName}`
            : t('households.payer') + ': —'
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/households">
              <Button variant="secondary" size="sm">
                {t('common.back')}
              </Button>
            </Link>
            <Link href={`/households/${householdId}/edit`}>
              <Button size="sm">{t('common.edit')}</Button>
            </Link>
            <HouseholdActions householdId={householdId} householdName={household.name} />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('households.members')}</CardTitle>
        </CardHeader>
        {householdMemberRows.length === 0 ? (
          <CardBody>
            <p className="text-muted text-sm">{t('households.empty')}</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('members.memberCode')}</Th>
                <Th>{t('members.firstName')} {t('members.lastName')}</Th>
                <Th>{t('households.relationship')}</Th>
                <Th>{t('members.status')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {householdMemberRows.map((row) => (
                <tr key={row.memberId}>
                  <Td className="font-mono text-xs text-muted">
                    {formatMemberCode(row.memberSeq)}
                  </Td>
                  <Td className="font-medium">
                    {row.firstName} {row.lastName}
                    {row.memberId === household.payerMemberId && (
                      <Badge tone="primary" className="ml-2">
                        {t('households.payer')}
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-muted capitalize">{row.relationship}</Td>
                  <Td>
                    <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
                      {t(`members.statuses.${row.status}`)}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/members/${row.memberId}`}
                      className="text-[var(--color-primary)] text-sm hover:underline underline-offset-2"
                    >
                      {t('common.view')}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('households.addMember')}</CardTitle>
        </CardHeader>
        <CardBody>
          <AddHouseholdMemberForm
            householdId={householdId}
            availableMembers={availableMembersData}
          />
        </CardBody>
      </Card>
    </>
  );
}
