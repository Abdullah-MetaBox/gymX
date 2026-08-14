import { formatMemberCode, members } from '@gymx/db';
import { asc, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';
import { NewHouseholdForm } from '../form';

export default async function NewHouseholdPage() {
  const t = await getTranslations();
  await requirePageAccess('create', 'household');

  const membersList = await queryInGym({ action: 'read', subject: 'member' }, (db) =>
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
  );

  return (
    <>
      <PageHeader title={t('households.createTitle')} />
      <NewHouseholdForm membersList={membersList} />
    </>
  );
}
