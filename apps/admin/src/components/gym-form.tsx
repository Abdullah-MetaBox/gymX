'use client';

import { LOCALE_LABELS, LOCALES } from '@gymx/i18n';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '../lib/action';
import { Alert, Button, Card, CardBody, Field, Input, Select } from './ui/index';

export interface GymFormValues {
  gymId?: string;
  name: string;
  slug: string;
  brn: string;
  vatNumber: string;
  timezone: string;
  currency: string;
  vatRatePercent: number;
  defaultLocale: string;
  locales: string[];
  minContractMonths: number;
  overdueGraceDays: number;
  atRiskDays: number;
  primaryColor: string;
  enabledModules: string[];
}

export interface GymFormLabels {
  name: string;
  slug: string;
  slugHelp: string;
  brn: string;
  vatNumber: string;
  timezone: string;
  currency: string;
  vatRate: string;
  vatRateHelp: string;
  defaultLocale: string;
  locales: string;
  minContractMonths: string;
  overdueGraceDays: string;
  graceHelp: string;
  atRiskDays: string;
  primaryColor: string;
  enabledModules: string;
  submit: string;
  saved: string;
}

const TIME_ZONES = [
  'Indian/Mauritius',
  'Indian/Reunion',
  'Africa/Nairobi',
  'Europe/Paris',
  'Europe/London',
  'UTC',
];

export function GymForm({
  mode,
  values,
  labels,
  availableModules,
  onSubmit,
  redirectTo,
}: {
  mode: 'create' | 'edit';
  values: GymFormValues;
  labels: GymFormLabels;
  availableModules: { id: string; name: string }[];
  onSubmit: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<{ id: string }> | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const input: Record<string, unknown> = {
      name: form.get('name'),
      brn: form.get('brn') ?? '',
      vatNumber: form.get('vatNumber') ?? '',
      timezone: form.get('timezone'),
      currency: form.get('currency'),
      vatRatePercent: form.get('vatRatePercent'),
      defaultLocale: form.get('defaultLocale'),
      locales: form.getAll('locales'),
      minContractMonths: form.get('minContractMonths'),
      overdueGraceDays: form.get('overdueGraceDays'),
      atRiskDays: form.get('atRiskDays'),
      primaryColor: form.get('primaryColor') ?? '',
      enabledModules: form.getAll('enabledModules'),
    };
    if (mode === 'create') input.slug = form.get('slug');
    if (values.gymId) input.gymId = values.gymId;

    startTransition(async () => {
      const outcome = await onSubmit(input);
      setResult(outcome);
      if (outcome.ok) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    });
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
      {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
      {result?.ok ? <Alert tone="info">{labels.saved}</Alert> : null}

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.name} htmlFor="name" errors={fieldErrors.name} required>
            <Input id="name" name="name" defaultValue={values.name} required />
          </Field>

          <Field
            label={labels.slug}
            htmlFor="slug"
            hint={labels.slugHelp}
            errors={fieldErrors.slug}
            required
          >
            <Input
              id="slug"
              name="slug"
              defaultValue={values.slug}
              required
              disabled={mode === 'edit'}
            />
          </Field>

          <Field label={labels.brn} htmlFor="brn" errors={fieldErrors.brn}>
            <Input id="brn" name="brn" defaultValue={values.brn} />
          </Field>

          <Field label={labels.vatNumber} htmlFor="vatNumber" errors={fieldErrors.vatNumber}>
            <Input id="vatNumber" name="vatNumber" defaultValue={values.vatNumber} />
          </Field>

          <Field label={labels.timezone} htmlFor="timezone" errors={fieldErrors.timezone} required>
            <Select id="timezone" name="timezone" defaultValue={values.timezone}>
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={labels.currency} htmlFor="currency" errors={fieldErrors.currency} required>
            <Input id="currency" name="currency" defaultValue={values.currency} maxLength={3} />
          </Field>

          <Field
            label={labels.vatRate}
            htmlFor="vatRatePercent"
            hint={labels.vatRateHelp}
            errors={fieldErrors.vatRatePercent}
            required
          >
            <Input
              id="vatRatePercent"
              name="vatRatePercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={values.vatRatePercent}
            />
          </Field>

          <Field
            label={labels.primaryColor}
            htmlFor="primaryColor"
            errors={fieldErrors.primaryColor}
          >
            <Input
              id="primaryColor"
              name="primaryColor"
              type="text"
              placeholder="#e8412f"
              defaultValue={values.primaryColor}
            />
          </Field>

          <Field
            label={labels.minContractMonths}
            htmlFor="minContractMonths"
            errors={fieldErrors.minContractMonths}
          >
            <Input
              id="minContractMonths"
              name="minContractMonths"
              type="number"
              min="0"
              max="60"
              defaultValue={values.minContractMonths}
            />
          </Field>

          <Field
            label={labels.overdueGraceDays}
            htmlFor="overdueGraceDays"
            hint={labels.graceHelp}
            errors={fieldErrors.overdueGraceDays}
          >
            <Input
              id="overdueGraceDays"
              name="overdueGraceDays"
              type="number"
              min="0"
              max="90"
              defaultValue={values.overdueGraceDays}
            />
          </Field>

          <Field label={labels.atRiskDays} htmlFor="atRiskDays" errors={fieldErrors.atRiskDays}>
            <Input
              id="atRiskDays"
              name="atRiskDays"
              type="number"
              min="1"
              max="365"
              defaultValue={values.atRiskDays}
            />
          </Field>

          <Field
            label={labels.defaultLocale}
            htmlFor="defaultLocale"
            errors={fieldErrors.defaultLocale}
          >
            <Select id="defaultLocale" name="defaultLocale" defaultValue={values.defaultLocale}>
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <p className="mb-2 font-medium text-sm">{labels.locales}</p>
            <div className="flex flex-wrap gap-4">
              {LOCALES.map((locale) => (
                <label key={locale} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="locales"
                    value={locale}
                    defaultChecked={values.locales.includes(locale)}
                  />
                  {LOCALE_LABELS[locale]}
                </label>
              ))}
            </div>
          </div>

          {availableModules.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="mb-2 font-medium text-sm">{labels.enabledModules}</p>
              <div className="flex flex-wrap gap-4">
                {availableModules.map((module) => (
                  <label key={module.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabledModules"
                      value={module.id}
                      defaultChecked={values.enabledModules.includes(module.id)}
                    />
                    {module.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Button type="submit" disabled={pending}>
        {labels.submit}
      </Button>
    </form>
  );
}
