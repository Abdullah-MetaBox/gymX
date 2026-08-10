import { can } from '@gymx/core/auth';
import { formatMemberCode, memberDocuments, members } from '@gymx/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';

const STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  frozen: 'warning',
} as const;

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'member');

  const [member, docs] = await Promise.all([
    queryInGym({ action: 'read', subject: 'member' }, (db) =>
      db.select().from(members).where(eq(members.id, memberId)).limit(1).then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'document' }, (db) =>
      db
        .select()
        .from(memberDocuments)
        .where(eq(memberDocuments.memberId, memberId))
        .orderBy(memberDocuments.createdAt),
    ),
  ]);

  if (!member) notFound();

  const canEdit = can(context.actor.role, 'update', 'member');

  return (
    <>
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        subtitle={formatMemberCode(member.memberSeq)}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/members">
              <Button variant="secondary" size="sm">
                {t('common.back')}
              </Button>
            </Link>
            {canEdit && (
              <Link href={`/members/${memberId}/edit`}>
                <Button size="sm">{t('common.edit')}</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: key info */}
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('members.overview')}</CardTitle>
                <Badge tone={STATUS_TONE[member.status]}>
                  {t(`members.statuses.${member.status}`)}
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Row label={t('members.email')} value={member.email} />
              <Row label={t('members.phone')} value={member.phone} />
              <Row label={t('members.dateOfBirth')} value={member.dateOfBirth} />
              <Row
                label={t('members.gender')}
                value={member.gender ? t(`members.genders.${member.gender}`) : null}
              />
              <Row label={t('members.nic')} value={member.nic} />
              <Row label={t('members.joinedAt')} value={member.joinedAt} />
              <Row label={t('members.locale')} value={member.locale} />
            </CardBody>
          </Card>

          {(member.emergencyContactName || member.emergencyContactPhone) && (
            <Card>
              <CardHeader>
                <CardTitle>{t('members.emergencyContact')}</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <Row label={t('members.emergencyContact')} value={member.emergencyContactName} />
                <Row label={t('members.emergencyPhone')} value={member.emergencyContactPhone} />
              </CardBody>
            </Card>
          )}

          {member.address && (
            <Card>
              <CardHeader>
                <CardTitle>{t('members.address')}</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm whitespace-pre-line">{member.address}</p>
              </CardBody>
            </Card>
          )}

          {member.medicalNote && (
            <Card>
              <CardHeader>
                <CardTitle>{t('members.medicalNote')}</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm whitespace-pre-line">{member.medicalNote}</p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right: documents */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('members.documents')}</CardTitle>
            </CardHeader>
            {docs.length === 0 ? (
              <CardBody>
                <p className="text-muted text-sm">{t('members.noDocuments')}</p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Label</Th>
                    <Th>Verified</Th>
                    <Th>Expires</Th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <Td>
                        <Badge tone="neutral">{doc.kind.replace(/_/g, ' ')}</Badge>
                      </Td>
                      <Td>{doc.label ?? '—'}</Td>
                      <Td>
                        {doc.verifiedAt ? (
                          <Badge tone="success">Verified</Badge>
                        ) : (
                          <span className="text-muted text-xs">Unverified</span>
                        )}
                      </Td>
                      <Td className="text-muted">{doc.expiresAt ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-right truncate">{value ?? '—'}</span>
    </div>
  );
}
