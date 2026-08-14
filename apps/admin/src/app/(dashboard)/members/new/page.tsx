import { plans } from '@gymx/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MemberForm } from '../../../../components/member-form';
import { Button, PageHeader } from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';
import { createMemberAndRedirect } from '../actions';

export default async function NewMemberPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('create', 'member');

  // Fetch plans for this gym
  const gymPlans = await queryInGym({ action: 'read', subject: 'plan' }, (db) =>
    db.select().from(plans).orderBy(plans.sortOrder),
  );

  return (
    <>
      <PageHeader
        title={t('members.createTitle')}
        actions={
          <Link href="/members">
            <Button variant="secondary" size="sm">
              {t('common.back')}
            </Button>
          </Link>
        }
      />
      <MemberForm
        action={createMemberAndRedirect}
        role={context.actor.role}
        submitLabel={t('members.create')}
        cancelHref="/members"
        plans={gymPlans.map((p) => ({ id: p.id, nameI18n: p.nameI18n as Record<string, string> }))}
      />
    </>
  );
}
