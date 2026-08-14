import { Money } from '@gymx/core';
import { formatMemberCode } from '@gymx/db';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Avatar, Badge, Card, CardBody, CardHeader } from '../../../components/ui/index';
import type { MemberGroup, MemberRow } from '../../../lib/member-grouping';
import { FamilySummary } from './family-summary';

const STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  frozen: 'warning',
} as const;

export async function MemberGridView({ groups }: { groups: MemberGroup[] }) {
  const familyGroups = groups.filter((g) => g.kind === 'family');
  const solos = groups.filter((g) => g.kind === 'solo').map((g) => g.member);

  return (
    <div className="space-y-6">
      {familyGroups.map((family) => (
        <Card key={family.householdId}>
          <CardHeader>
            <FamilySummary family={family} />
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {family.members.map((member) => (
                <MemberTile key={member.id} member={member} />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {solos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {solos.map((member) => (
            <MemberTile key={member.id} member={member} bordered />
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function MemberTile({ member, bordered }: { member: MemberRow; bordered?: boolean }) {
  const t = await getTranslations();
  const name = `${member.firstName} ${member.lastName}`;

  return (
    <Link
      href={`/members/${member.id}`}
      className={`hover:surface-2 flex gap-3 rounded-[var(--radius-card)] p-3 transition ${
        bordered ? 'surface border border-[var(--color-border)]' : 'surface-2'
      }`}
    >
      <Avatar src={member.photoUrl} name={name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-medium text-sm">{name}</p>
          <Badge tone={STATUS_TONE[member.status]}>{t(`members.statuses.${member.status}`)}</Badge>
        </div>
        <p className="text-muted font-mono text-xs">{formatMemberCode(member.memberSeq)}</p>
        <p className="mt-1 truncate text-xs">
          {member.planName ? (
            <>
              {member.planName}
              {member.priceCents !== null ? (
                <span className="text-muted tabular-nums">
                  {' · '}
                  {Money.format(Money.cents(member.priceCents), { currency: 'MUR' })}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[#D946EF]">{t('members.noPlan')}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
