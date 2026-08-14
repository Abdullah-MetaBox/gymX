'use client';

import { Money, Pricing } from '@gymx/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Alert, Button, Field, Input, Select } from '../../../../components/ui/index';
import { assignPlanAction } from '../actions';

interface PlanOption {
  id: string;
  name: string;
  pricingModel: Pricing.PricingModel;
  basePriceCents: number;
  tiers: Pricing.PriceTier[];
}

export function AssignPlanForm({
  plans,
  members,
  households,
  defaultMemberId,
  defaultHouseholdId,
}: {
  plans: PlanOption[];
  members: { id: string; label: string }[];
  households: { id: string; name: string; memberCount: number }[];
  defaultMemberId?: string;
  defaultHouseholdId?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<'member' | 'family'>(defaultHouseholdId ? 'family' : 'member');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [memberId, setMemberId] = useState(defaultMemberId ?? members[0]?.id ?? '');
  const [householdId, setHouseholdId] = useState(defaultHouseholdId ?? households[0]?.id ?? '');
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().slice(0, 10));

  // Mirrors the server's derivation so the number on screen is the number that
  // will be charged. The server still computes it independently on submit — this
  // is a preview, not the source of truth.
  const preview = useMemo(() => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return null;
    const size =
      scope === 'family' ? (households.find((h) => h.id === householdId)?.memberCount ?? 1) : 1;
    return { size, ...Pricing.priceForSize({ ...plan, size }) };
  }, [planId, scope, householdId, plans, households]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await assignPlanAction({
        planId,
        scope,
        memberId: scope === 'member' ? memberId : undefined,
        householdId: scope === 'family' ? householdId : undefined,
        startsOn,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push('/members');
      router.refresh();
    });
  }

  const noTargets = scope === 'family' ? households.length === 0 : members.length === 0;

  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <fieldset>
        <legend className="mb-2 font-medium text-sm">{t('subscriptions.scope')}</legend>
        <div className="flex gap-4">
          {(['member', 'family'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
              />
              {t(`subscriptions.scope_${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {scope === 'member' ? (
        <Field label={t('subscriptions.member')} htmlFor="memberId" required>
          <Select
            id="memberId"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            required
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label={t('subscriptions.family')} htmlFor="householdId" required>
          <Select
            id="householdId"
            value={householdId}
            onChange={(e) => setHouseholdId(e.target.value)}
            required
          >
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({t('households.memberCount', { count: h.memberCount })})
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label={t('nav.plans')} htmlFor="planId" required>
        <Select id="planId" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('subscriptions.startsOn')} htmlFor="startsOn" required>
        <Input
          id="startsOn"
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          required
        />
      </Field>

      {preview ? (
        <div className="surface-2 rounded-[var(--radius-card)] p-4">
          <p className="text-muted text-xs">{t('subscriptions.derivedPrice')}</p>
          <p className="font-bold text-2xl tabular-nums">
            {Money.format(preview.totalCents, { currency: 'MUR' })}
          </p>
          <p className="text-muted mt-1 text-xs">
            {t(`subscriptions.basis_${preview.basis}`, { size: preview.size })}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || noTargets || !planId}>
          {pending ? t('common.loading') : t('subscriptions.assign')}
        </Button>
        <a href="/members" className="text-muted text-sm hover:underline">
          {t('common.cancel')}
        </a>
      </div>

      {noTargets ? <Alert tone="info">{t('subscriptions.noTargets')}</Alert> : null}
    </form>
  );
}
