import { Money } from '@gymx/core';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '../../../components/ui/index';
import type { FamilyGroup } from '../../../lib/member-grouping';

/**
 * The line that heads a family, in both the table and the card view.
 *
 * The "3 of 4 covered" badge is the reason this screen exists. A family
 * membership that silently fails to cover someone is precisely the class of
 * failure the product is designed to catch — so it is stated on the row, not
 * buried a click away.
 */
export async function FamilySummary({ family }: { family: FamilyGroup }) {
  const t = await getTranslations();
  const size = family.members.length;
  const allCovered = family.coveredCount === size;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href={`/households/${family.householdId}`} className="font-medium hover:underline">
        {family.householdName}
      </Link>

      <span className="text-muted text-xs">{t('households.memberCount', { count: size })}</span>

      {family.planName ? (
        <span className="text-muted text-xs">
          {family.planName}
          {family.priceCents !== null
            ? ` · ${Money.format(Money.cents(family.priceCents), { currency: 'MUR' })}`
            : ''}
        </span>
      ) : null}

      <Badge tone={allCovered ? 'success' : 'warning'}>
        {t('members.coveredCount', { covered: family.coveredCount, total: size })}
      </Badge>
    </div>
  );
}
