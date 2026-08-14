import { guestPasses, members, users } from '@gymx/db';
import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
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
} from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';
import { GuestPassForm } from './guest-pass-form';

export default async function GuestPassesPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'guest_pass');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('guestPasses.title')} subtitle={t('guestPasses.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} />
      </>
    );
  }

  const today: string = new Date().toISOString().split('T')[0]!;

  const [passes, memberList] = await Promise.all([
    queryInGym({ action: 'read', subject: 'guest_pass' }, (db) =>
      db
        .select({
          id: guestPasses.id,
          guestName: guestPasses.guestName,
          guestPhone: guestPasses.guestPhone,
          validOn: guestPasses.validOn,
          usedAt: guestPasses.usedAt,
          hostFirstName: members.firstName,
          hostLastName: members.lastName,
          issuedByName: users.name,
        })
        .from(guestPasses)
        .leftJoin(members, eq(members.id, guestPasses.hostMemberId))
        .leftJoin(users, eq(users.id, guestPasses.issuedBy))
        .where(eq(guestPasses.validOn, today))
        .orderBy(desc(guestPasses.createdAt))
        .limit(100),
    ),
    queryInGym({ action: 'read', subject: 'member' }, (db) =>
      db
        .select({ id: members.id, firstName: members.firstName, lastName: members.lastName })
        .from(members)
        .where(eq(members.status, 'active'))
        .orderBy(members.lastName, members.firstName)
        .limit(500),
    ),
  ]);

  const canCreate = context.actor.role !== 'accountant';

  return (
    <>
      <PageHeader title={t('guestPasses.title')} subtitle={t('guestPasses.subtitle')} />

      <div className="grid gap-6 lg:grid-cols-3">
        {canCreate && (
          <div className="lg:col-span-1">
            <GuestPassForm memberList={memberList} />
          </div>
        )}

        <div className={canCreate ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {passes.length === 0 ? (
            <EmptyState title={t('guestPasses.empty')} />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('guestPasses.guestName')}</Th>
                    <Th>{t('guestPasses.hostMember')}</Th>
                    <Th>{t('guestPasses.issuedBy')}</Th>
                    <Th>{t('guestPasses.usedAt')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {passes.map((pass) => (
                    <tr key={pass.id}>
                      <Td>
                        <p className="font-medium">{pass.guestName}</p>
                        {pass.guestPhone && <p className="text-muted text-xs">{pass.guestPhone}</p>}
                      </Td>
                      <Td className="text-muted">
                        {pass.hostFirstName ? `${pass.hostFirstName} ${pass.hostLastName}` : '—'}
                      </Td>
                      <Td className="text-muted">{pass.issuedByName ?? '—'}</Td>
                      <Td>
                        {pass.usedAt ? (
                          <Badge tone="success">{t('guestPasses.usedAt')}</Badge>
                        ) : (
                          <Badge tone="neutral">{t('guestPasses.notUsed')}</Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
