import { getTranslations } from 'next-intl/server';
import { EmptyState, PageHeader } from '../../../components/ui/index';
import { requirePageAccess } from '../../../lib/session';

export default async function PaymentsPage() {
  const t = await getTranslations();
  await requirePageAccess('read', 'payment');

  return (
    <>
      <PageHeader title="Payments" subtitle="Record and track payments" />
      <EmptyState title="Coming soon" body="Payment recording, allocation, and reconciliation." />
    </>
  );
}
