'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { Alert, Badge, Button, Field, Input, Select } from './ui/index';

interface AccessRule {
  area: 'gym' | 'pool' | 'classes';
  weekdays?: number[];
  startTime?: string;
  endTime?: string;
}

interface PriceTier {
  sizeFrom: number;
  sizeTo?: number;
  priceCents: number;
}

interface PlanFormProps {
  action: (
    input: unknown,
  ) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  defaultValues?: Record<string, unknown>;
  planId?: string;
  submitLabel: string;
  cancelHref?: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PlanForm({
  action,
  defaultValues = {},
  planId,
  submitLabel,
  cancelHref,
}: PlanFormProps) {
  const t = useTranslations();

  const [planType, setPlanType] = useState<string>((defaultValues.type as string) ?? 'contract');
  const [pricingModel, setPricingModel] = useState<string>(
    (defaultValues.pricingModel as string) ?? 'flat',
  );
  const [accessRules, setAccessRules] = useState<AccessRule[]>(
    (defaultValues.accessRules as AccessRule[]) ?? [],
  );
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>(
    (defaultValues.priceTiers as PriceTier[]) ?? [],
  );

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const data: Record<string, unknown> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') data[key] = value;
      }
      if (planId) data.planId = planId;
      data.accessRules = accessRules;
      data.priceTiers = priceTiers.map((t) => ({
        ...t,
        priceCents: Math.round(t.priceCents),
      }));
      return action(data);
    },
    null,
  );

  const fieldError = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined);

  function addAccessRule() {
    setAccessRules((r) => [...r, { area: 'gym' }]);
  }

  function updateRule(i: number, patch: Partial<AccessRule>) {
    setAccessRules((rules) => rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRule(i: number) {
    setAccessRules((rules) => rules.filter((_, idx) => idx !== i));
  }

  function toggleWeekday(ruleIdx: number, day: number) {
    setAccessRules((rules) =>
      rules.map((r, idx) => {
        if (idx !== ruleIdx) return r;
        const current = r.weekdays ?? [];
        const next = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day].sort();
        return { ...r, weekdays: next.length === 7 ? undefined : next };
      }),
    );
  }

  function addTier() {
    setPriceTiers((t) => [...t, { sizeFrom: t.length + 1, priceCents: 0 }]);
  }

  function updateTier(i: number, patch: Partial<PriceTier>) {
    setPriceTiers((tiers) => tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function removeTier(i: number) {
    setPriceTiers((tiers) => tiers.filter((_, idx) => idx !== i));
  }

  const showTiers = pricingModel === 'flat_by_size' || pricingModel === 'per_head_by_size';

  return (
    <form action={formAction} className="space-y-8 max-w-2xl">
      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}

      {/* Name */}
      <section className="space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted">Plan details</h2>
        <Field
          label={`${t('plans.name')} (English)`}
          htmlFor="nameEn"
          required
          errors={fieldError('nameEn')}
        >
          <Input
            id="nameEn"
            name="nameEn"
            defaultValue={(defaultValues.nameEn as string) ?? ''}
            required
          />
        </Field>
        <Field label={`${t('plans.name')} (Français)`} htmlFor="nameFr">
          <Input id="nameFr" name="nameFr" defaultValue={(defaultValues.nameFr as string) ?? ''} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('plans.type')} htmlFor="type" required>
            <Select
              id="type"
              name="type"
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
              required
            >
              <option value="contract">{t('plans.types.contract')}</option>
              <option value="pass">{t('plans.types.pass')}</option>
            </Select>
          </Field>
          <Field label={t('plans.category')} htmlFor="category" required>
            <Select
              id="category"
              name="category"
              defaultValue={(defaultValues.category as string) ?? 'solo'}
              required
            >
              {(['solo', 'couple', 'family', 'group', 'student', 'lunch', 'full'] as const).map(
                (c) => (
                  <option key={c} value={c}>
                    {t(`plans.categories.${c}`)}
                  </option>
                ),
              )}
            </Select>
          </Field>
        </div>

        {planType === 'contract' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('plans.billingInterval')} htmlFor="billingInterval">
              <Select
                id="billingInterval"
                name="billingInterval"
                defaultValue={(defaultValues.billingInterval as string) ?? 'monthly'}
              >
                <option value="monthly">{t('plans.intervals.monthly')}</option>
                <option value="quarterly">{t('plans.intervals.quarterly')}</option>
                <option value="annual">{t('plans.intervals.annual')}</option>
              </Select>
            </Field>
            <Field label={t('plans.minTermMonths')} htmlFor="minTermMonths" hint="0 = no minimum">
              <Input
                id="minTermMonths"
                name="minTermMonths"
                type="number"
                min={0}
                defaultValue={(defaultValues.minTermMonths as number) ?? 0}
              />
            </Field>
          </div>
        )}

        {planType === 'pass' && (
          <Field label={t('plans.passDurationDays')} htmlFor="passDurationDays" required>
            <Input
              id="passDurationDays"
              name="passDurationDays"
              type="number"
              min={1}
              defaultValue={(defaultValues.passDurationDays as number) ?? 1}
              required
            />
          </Field>
        )}
      </section>

      {/* Pricing */}
      <section className="space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted">
          {t('plans.pricing')}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('plans.pricingModel')} htmlFor="pricingModel">
            <Select
              id="pricingModel"
              name="pricingModel"
              value={pricingModel}
              onChange={(e) => {
                setPricingModel(e.target.value);
                if (e.target.value === 'flat') setPriceTiers([]);
              }}
            >
              <option value="flat">{t('plans.models.flat')}</option>
              <option value="flat_by_size">{t('plans.models.flat_by_size')}</option>
              <option value="per_head_by_size">{t('plans.models.per_head_by_size')}</option>
            </Select>
          </Field>
          <Field
            label={`${t('plans.basePrice')} (MUR)`}
            htmlFor="basePriceMajor"
            required
            hint={pricingModel !== 'flat' ? 'Solo / default price' : undefined}
          >
            <Input
              id="basePriceMajor"
              name="basePriceMajor"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(defaultValues.basePriceMajor as number) ?? ''}
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t('plans.joiningFee')} (MUR)`} htmlFor="joiningFeeMajor">
            <Input
              id="joiningFeeMajor"
              name="joiningFeeMajor"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(defaultValues.joiningFeeMajor as number) ?? 0}
            />
          </Field>
          <div className="flex items-end pb-1 gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="vatInclusive"
                value="true"
                defaultChecked={(defaultValues.vatInclusive as boolean) ?? false}
                className="rounded"
              />
              {t('plans.vatInclusive')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="active"
                value="true"
                defaultChecked={(defaultValues.active as boolean) ?? true}
                className="rounded"
              />
              {t('plans.active')}
            </label>
          </div>
        </div>

        {/* Price tiers */}
        {showTiers && (
          <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {pricingModel === 'flat_by_size' ? t('plans.tiersFlat') : t('plans.tiersPerHead')}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={addTier}>
                + Add tier
              </Button>
            </div>
            {priceTiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted shrink-0">Size</span>
                <Input
                  type="number"
                  min={1}
                  value={tier.sizeFrom}
                  onChange={(e) => updateTier(i, { sizeFrom: Number(e.target.value) })}
                  className="w-16 h-8 text-xs"
                />
                <span className="text-muted">–</span>
                <Input
                  type="number"
                  min={1}
                  value={tier.sizeTo ?? ''}
                  placeholder="∞"
                  onChange={(e) =>
                    updateTier(i, { sizeTo: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-16 h-8 text-xs"
                />
                <span className="text-muted shrink-0">MUR</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tier.priceCents / 100}
                  onChange={(e) =>
                    updateTier(i, { priceCents: Math.round(Number(e.target.value) * 100) })
                  }
                  className="w-24 h-8 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  className="text-[var(--color-denied)] text-xs hover:underline shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
            {priceTiers.length === 0 && (
              <p className="text-muted text-xs">No tiers yet. Add at least one.</p>
            )}
          </div>
        )}
      </section>

      {/* Access rules */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted">
            {t('plans.accessRules')}
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={addAccessRule}>
            + Add area
          </Button>
        </div>

        {accessRules.length === 0 && (
          <p className="text-muted text-sm">
            No access rules yet. Members on this plan can access nothing until rules are added.
          </p>
        )}

        {accessRules.map((rule, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-border)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Select
                  value={rule.area}
                  onChange={(e) =>
                    updateRule(i, { area: e.target.value as 'gym' | 'pool' | 'classes' })
                  }
                  className="h-8 text-sm w-28"
                >
                  <option value="gym">Gym floor</option>
                  <option value="pool">Pool</option>
                  <option value="classes">Classes</option>
                </Select>
                <Badge tone="neutral">{rule.area}</Badge>
              </div>
              <button
                type="button"
                onClick={() => removeRule(i)}
                className="text-[var(--color-denied)] text-xs hover:underline"
              >
                Remove
              </button>
            </div>

            <div>
              <p className="text-xs text-muted mb-1.5">Days (leave all unchecked = every day)</p>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = !rule.weekdays || rule.weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(i, day)}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                          : 'border-[var(--color-border)] text-muted hover:surface-2'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted shrink-0">Time window</span>
              <Input
                type="time"
                value={rule.startTime ?? ''}
                onChange={(e) => updateRule(i, { startTime: e.target.value || undefined })}
                className="h-8 w-28 text-xs"
                placeholder="00:00"
              />
              <span className="text-muted">–</span>
              <Input
                type="time"
                value={rule.endTime ?? ''}
                onChange={(e) => updateRule(i, { endTime: e.target.value || undefined })}
                className="h-8 w-28 text-xs"
                placeholder="24:00"
              />
              <span className="text-muted text-xs">(leave blank = all day)</span>
            </div>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? t('common.loading') : submitLabel}
        </Button>
        {cancelHref && (
          <a href={cancelHref} className="text-muted text-sm hover:underline">
            {t('common.cancel')}
          </a>
        )}
      </div>
    </form>
  );
}
