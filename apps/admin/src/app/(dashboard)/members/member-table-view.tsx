import { Money } from '@gymx/core';
import { formatMemberCode } from '@gymx/db';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Avatar, Badge, Table, Td, Th } from '../../../components/ui/index';
import type { MemberGroup, MemberRow } from '../../../lib/member-grouping';
import { FamilySummary } from './family-summary';

const STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  frozen: 'warning',
} as const;

const COLUMN_COUNT = 6;

/** The condensed view: many members visible at once, photo included. */
export async function MemberTableView({ groups }: { groups: MemberGroup[] }) {
  const t = await getTranslations();

  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-12" />
          <Th>{t('members.title')}</Th>
          <Th>{t('members.memberCode')}</Th>
          <Th>{t('members.contact')}</Th>
          <Th>{t('nav.plans')}</Th>
          <Th>{t('members.status')}</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) =>
          group.kind === 'solo' ? (
            <MemberRowCells key={group.member.id} member={group.member} />
          ) : (
            [
              <tr key={`${group.householdId}-header`} className="surface-2">
                {/* scope=colgroup so a screen reader announces this as the heading
                    for the rows beneath it, not as a stray data cell. */}
                <th scope="colgroup" colSpan={COLUMN_COUNT} className="px-3 py-2 text-left">
                  <FamilySummary family={group} />
                </th>
              </tr>,
              ...group.members.map((member) => (
                <MemberRowCells key={member.id} member={member} nested />
              )),
            ]
          ),
        )}
      </tbody>
    </Table>
  );
}

async function MemberRowCells({ member, nested }: { member: MemberRow; nested?: boolean }) {
  const t = await getTranslations();
  const name = `${member.firstName} ${member.lastName}`;
  const covered = member.subscriptionStatus === 'active';

  return (
    <tr className="hover:surface-2">
      <Td className={nested ? 'border-[var(--color-primary)]/30 border-l-2 pl-4' : ''}>
        <Avatar src={member.photoUrl} name={name} size="sm" />
      </Td>
      <Td className="font-medium">
        <Link href={`/members/${member.id}`} className="hover:underline">
          {name}
        </Link>
        {member.relationship && member.relationship !== 'other' ? (
          <span className="text-muted ml-2 text-xs capitalize">{member.relationship}</span>
        ) : null}
      </Td>
      <Td className="text-muted font-mono text-xs">{formatMemberCode(member.memberSeq)}</Td>
      <Td className="text-muted text-xs">
        <div className="truncate">{member.email ?? '—'}</div>
        <div>{member.phone ?? ''}</div>
      </Td>
      <Td className="text-xs">
        {member.planName ? (
          <>
            <div>{member.planName}</div>
            {member.priceCents !== null ? (
              <div className="text-muted tabular-nums">
                {Money.format(Money.cents(member.priceCents), { currency: 'MUR' })}
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-[#D946EF]">{t('members.noPlan')}</span>
        )}
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[member.status]}>{t(`members.statuses.${member.status}`)}</Badge>
          {!covered && member.subscriptionStatus ? (
            <span className="text-muted text-xs capitalize">{member.subscriptionStatus}</span>
          ) : null}
        </div>
      </Td>
    </tr>
  );
}
