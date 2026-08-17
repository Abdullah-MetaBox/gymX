import { formatMemberCode, households, members } from '@gymx/db';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button, PageHeader } from '../../../../../components/ui/index';
import { queryInGym } from '../../../../../lib/action';
import { requirePageAccess } from '../../../../../lib/session';
import { HouseholdForm } from '../edit-form';

export default async function EditHouseholdPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const t = await getTranslations();
  await requirePageAccess('update', 'household');

  const [household, membersList] = await Promise.all([
    queryInGym({ action: 'read', subject: 'household' }, (db) =>
      db
        .select()
        .from(households)
        .where(eq(households.id, householdId))
        .limit(1)
        .then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'member' }, (db) =>
      db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          memberSeq: members.memberSeq,
        })
        .from(members)
        .where(eq(members.status, 'active'))
        .orderBy(asc(members.lastName), asc(members.firstName)),
    ),
  ]);

  if (!household) notFound();

  return (
    <>
      <PageHeader
        title={t('households.editTitle')}
        subtitle={household.name}
        actions={
          <Link href={`/households/${householdId}`}>
            <Button variant="secondary" size="sm">
              {t('common.back')}
            </Button>
          </Link>
        }
      />
      <HouseholdForm
        householdId={householdId}
        defaultName={household.name}
        defaultPayerMemberId={household.payerMemberId}
        membersList={membersList}
      />
    </>
  );
}
