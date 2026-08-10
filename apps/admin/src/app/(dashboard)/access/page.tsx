import { getTranslations } from 'next-intl/server';
import { EmptyState, PageHeader } from '../../../components/ui/index';
import { requirePageAccess } from '../../../lib/session';

export default async function AccessPage() {
  const t = await getTranslations();
  await requirePageAccess('read', 'access_event');

  return (
    <>
      <PageHeader title="Access control" subtitle="Entry/exit log and occupancy tracking" />
      <EmptyState title="Coming soon" body="Access decision engine, entry/exit log, occupancy dashboard." />
    </>
  );
}
