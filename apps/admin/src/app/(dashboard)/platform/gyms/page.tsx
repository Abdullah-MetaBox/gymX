import { gyms } from '@gymx/db';
import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../../components/ui/index';
import { queryOnPlatform } from '../../../../lib/action';
import { requireActiveContext } from '../../../../lib/session';
import { EnterGymButton } from './enter-gym-button';

/** Every gym on the platform. Reachable only through the audited platform context. */
export default async function PlatformGymsPage() {
  const context = await requireActiveContext();
  if (!context.principal.isPlatformAdmin) notFound();

  const t = await getTranslations();

  const rows = await queryOnPlatform({ action: 'read', subject: 'gym' }, (db) =>
    db.select().from(gyms).orderBy(asc(gyms.name)),
  );

  return (
    <>
      <PageHeader
        title={t('gyms.title')}
        subtitle={t('gyms.subtitle')}
        actions={
          <Link href="/platform/gyms/new">
            <Button>{t('gyms.create')}</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title={t('gyms.empty')} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{t('gyms.name')}</Th>
                <Th>{t('gyms.slug')}</Th>
                <Th>{t('gyms.timezone')}</Th>
                <Th>{t('gyms.vatRate')}</Th>
                <Th>{t('gyms.enabledModules')}</Th>
                <Th>{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((gym) => (
                <tr key={gym.id}>
                  <Td className="font-medium">{gym.name}</Td>
                  <Td className="font-mono text-muted text-xs">{gym.slug}</Td>
                  <Td className="text-muted">{gym.timezone}</Td>
                  <Td>{(gym.vatRateBp / 100).toFixed(2)}%</Td>
                  <Td>
                    {gym.enabledModules.length ? (
                      <div className="flex flex-wrap gap-1">
                        {gym.enabledModules.map((id) => (
                          <Badge key={id} tone="primary">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/platform/gyms/${gym.id}`}
                        className="text-[var(--color-primary)] text-sm underline-offset-2 hover:underline"
                      >
                        {t('common.edit')}
                      </Link>
                      <EnterGymButton gymId={gym.id} label={t('gymSwitcher.assume')} />
                    </div>
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
