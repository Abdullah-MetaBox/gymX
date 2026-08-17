import { getTranslations } from 'next-intl/server';
import { EmptyState, PageHeader } from '../../../components/ui/index';
import { requirePageAccess } from '../../../lib/session';

export default async function TillShiftsPage() {
  const t = await getTranslations();
  await requirePageAccess('read', 'till_shift');

  return (
    <>
      <PageHeader title="Till shifts" subtitle="Manage till shifts and cash accountability" />
      <EmptyState title="Coming soon" body="Open shifts, close shifts, and variance tracking." />
    </>
  );
}
