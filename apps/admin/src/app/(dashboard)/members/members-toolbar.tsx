import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Input } from '../../../components/ui/index';
import { MEMBER_STATUSES, type MemberStatus } from './query';

export type ViewMode = 'list' | 'grid';

export interface ToolbarState {
  q?: string;
  status?: MemberStatus;
  view: ViewMode;
}

function href(
  state: ToolbarState,
  patch: { q?: string | undefined; status?: MemberStatus | undefined; view?: ViewMode },
) {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.status) params.set('status', next.status);
  if (next.view !== 'list') params.set('view', next.view);
  const qs = params.toString();
  return qs ? `/members?${qs}` : '/members';
}

/**
 * No client JavaScript: the chips and the view toggle are links, and search is a
 * plain GET form. That keeps every piece of state in the URL, so a filtered view
 * survives a reload and can be pasted to a colleague.
 */
export async function MembersToolbar({
  state,
  statusCounts,
  total,
}: {
  state: ToolbarState;
  statusCounts: Record<MemberStatus, number>;
  total: number;
}) {
  const t = await getTranslations();

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" action="/members" className="flex items-center gap-2">
          {state.status ? <input type="hidden" name="status" value={state.status} /> : null}
          {state.view !== 'list' ? <input type="hidden" name="view" value={state.view} /> : null}
          <Input
            type="search"
            name="q"
            defaultValue={state.q ?? ''}
            placeholder={t('members.searchPlaceholder')}
            aria-label={t('common.search')}
            className="w-64"
          />
          <button
            type="submit"
            className="surface-2 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
          >
            {t('common.search')}
          </button>
          {state.q ? (
            <Link
              href={href(state, { q: undefined })}
              className="text-muted text-sm hover:underline"
            >
              {t('common.cancel')}
            </Link>
          ) : null}
        </form>

        <div
          className="flex items-center gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] p-1"
          role="group"
          aria-label={t('members.viewMode')}
        >
          {(['list', 'grid'] as const).map((mode) => (
            <Link
              key={mode}
              href={href(state, { view: mode })}
              aria-current={state.view === mode ? 'true' : undefined}
              className={
                state.view === mode
                  ? 'rounded-[calc(var(--radius-card)-2px)] bg-[var(--color-primary)] px-3 py-1 text-sm font-medium text-white'
                  : 'text-muted rounded-[calc(var(--radius-card)-2px)] px-3 py-1 text-sm font-medium'
              }
            >
              {t(`members.view_${mode}`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip
          href={href(state, { status: undefined })}
          selected={!state.status}
          label={t('members.statusAll')}
          count={total}
        />
        {MEMBER_STATUSES.map((status) => (
          <Chip
            key={status}
            href={href(state, { status })}
            selected={state.status === status}
            label={t(`members.statuses.${status}`)}
            count={statusCounts[status]}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  href: to,
  selected,
  label,
  count,
}: {
  href: string;
  selected: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={to}
      aria-current={selected ? 'true' : undefined}
      className={
        selected
          ? 'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1 font-medium text-sm text-white'
          : 'surface inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1 font-medium text-sm'
      }
    >
      {label}
      <span className={selected ? 'text-white/80' : 'text-muted'}>{count}</span>
    </Link>
  );
}
