import { Time } from '@gymx/core';
import { ROLE_LABELS } from '@gymx/core/auth';
import { getTranslations } from 'next-intl/server';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '../../components/ui/index';
import { requireActiveContext } from '../../lib/session';

export default async function DashboardPage() {
  const t = await getTranslations();
  const context = await requireActiveContext();
  const { principal, membership, actor } = context;

  const now = new Date();

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.welcome', { name: principal.name })}
        actions={<Badge tone="primary">{t('dashboard.phaseLabel')}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{membership?.gymName ?? t('gymSwitcher.platformView')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label={t('gyms.timezone')} value={context.timeZone} />
            <Row
              label="Local time"
              value={Time.formatInstant(now, { timeZone: context.timeZone })}
            />
            <Row label={t('locale.label')} value={context.locale.toUpperCase()} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your access</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Role" value={ROLE_LABELS[actor.role]} />
            <Row
              label="Gyms"
              value={String(principal.memberships.length || (principal.isPlatformAdmin ? '—' : 0))}
            />
            <Row
              label="Platform admin"
              value={principal.isPlatformAdmin ? t('common.yes') : t('common.no')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('gyms.enabledModules')}</CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            {membership?.enabledModules.length ? (
              <div className="flex flex-wrap gap-1.5">
                {membership.enabledModules.map((id) => (
                  <Badge key={id} tone="primary">
                    {id}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted">{t('common.none')}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <EmptyState title={t('dashboard.emptyTitle')} body={t('dashboard.emptyBody')} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
