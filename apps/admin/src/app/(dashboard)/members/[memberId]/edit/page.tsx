import { members } from '@gymx/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MemberForm } from '../../../../../components/member-form';
import { Button, PageHeader } from '../../../../../components/ui/index';
import { queryInGym } from '../../../../../lib/action';
import { requirePageAccess } from '../../../../../lib/session';
import { updateMemberAndRedirect } from '../../actions';

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const t = await getTranslations();
  const context = await requirePageAccess('update', 'member');

  const member = await queryInGym({ action: 'read', subject: 'member' }, (db) =>
    db.select().from(members).where(eq(members.id, memberId)).limit(1).then((r) => r[0]),
  );

  if (!member) notFound();

  const defaults = {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email ?? '',
    phone: member.phone ?? '',
    dateOfBirth: member.dateOfBirth ?? '',
    gender: member.gender ?? '',
    nic: member.nic ?? '',
    address: member.address ?? '',
    emergencyContactName: member.emergencyContactName ?? '',
    emergencyContactPhone: member.emergencyContactPhone ?? '',
    medicalNote: member.medicalNote ?? '',
    nfcUid: member.nfcUid ?? '',
    locale: member.locale,
    status: member.status,
    joinedAt: member.joinedAt,
  };

  return (
    <>
      <PageHeader
        title={t('members.editTitle')}
        subtitle={`${member.firstName} ${member.lastName}`}
        actions={
          <Link href={`/members/${memberId}`}>
            <Button variant="secondary" size="sm">
              {t('common.back')}
            </Button>
          </Link>
        }
      />
      <MemberForm
        action={updateMemberAndRedirect}
        defaultValues={defaults}
        memberId={memberId}
        role={context.actor.role}
        submitLabel={t('common.save')}
        cancelHref={`/members/${memberId}`}
      />
    </>
  );
}
