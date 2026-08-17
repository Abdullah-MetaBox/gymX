'use client';

import { Money } from '@gymx/core';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
} from '../../../components/ui/index';
import { closeTillShift, createTill, openTillShift } from '../payments/actions';

/**
 * Open or close the drawer.
 *
 * One shift at a time, deliberately: two open drawers make "who was short?"
 * unanswerable, which is the whole thing this screen exists to answer.
 */
export function CashDrawerControls({
  tills,
  openShift,
  expectedCents,
}: {
  tills: { id: string; name: string }[];
  openShift: { id: string; tillName: string } | null;
  expectedCents: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tillId, setTillId] = useState(tills[0]?.id ?? '');
  const [float, setFloat] = useState('0');
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [newTillName, setNewTillName] = useState('');

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? t('common.unknown'));
        return;
      }
      setCounted('');
      setNotes('');
      setNewTillName('');
      router.refresh();
    });
  }

  // Shown live so the person counting knows what the drawer should hold before
  // they commit a number — the variance is the point, not a gotcha.
  const countedCents = counted ? Money.fromMajor(Number(counted)) : null;
  const preview = countedCents === null ? null : countedCents - expectedCents;

  if (tills.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('tillShifts.createTill')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <p className="text-muted text-sm">{t('tillShifts.noTills')}</p>
          <div className="flex max-w-sm items-end gap-2">
            <Field label={t('tillShifts.tillName')} htmlFor="tillName">
              <Input
                id="tillName"
                value={newTillName}
                onChange={(e) => setNewTillName(e.target.value)}
                placeholder="Front desk"
              />
            </Field>
            <Button
              disabled={pending || !newTillName.trim()}
              onClick={() => run(() => createTill({ name: newTillName.trim() }))}
            >
              {t('common.create')}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {openShift ? t('tillShifts.openNow', { till: openShift.tillName }) : t('tillShifts.openA')}
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {openShift ? (
          <div className="space-y-4">
            <div className="surface-2 rounded-[var(--radius-card)] p-4">
              <p className="text-muted text-xs">{t('tillShifts.expected')}</p>
              <p className="font-bold text-2xl tabular-nums">
                {Money.format(Money.cents(expectedCents), { currency: 'MUR' })}
              </p>
              <p className="text-muted mt-1 text-xs">{t('tillShifts.expectedHint')}</p>
            </div>

            <div className="flex max-w-md flex-wrap items-end gap-3">
              <Field label={t('tillShifts.counted')} htmlFor="counted" required>
                <Input
                  id="counted"
                  type="number"
                  step="0.01"
                  min="0"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                />
              </Field>
              <Field label={t('tillShifts.notes')} htmlFor="notes">
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            {preview !== null ? (
              <p className={`text-sm ${preview === 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {preview === 0
                  ? t('tillShifts.balanced')
                  : t(preview > 0 ? 'tillShifts.over' : 'tillShifts.short', {
                      amount: Money.format(Money.cents(Math.abs(preview)), { currency: 'MUR' }),
                    })}
              </p>
            ) : null}

            <Button
              variant="danger"
              disabled={pending || counted === ''}
              onClick={() =>
                run(() =>
                  closeTillShift({
                    tillShiftId: openShift.id,
                    countedMajor: Number(counted),
                    notes: notes || undefined,
                  }),
                )
              }
            >
              {pending ? t('common.loading') : t('tillShifts.close')}
            </Button>
          </div>
        ) : (
          <div className="flex max-w-md flex-wrap items-end gap-3">
            <Field label={t('tillShifts.till')} htmlFor="tillId" required>
              <Select id="tillId" value={tillId} onChange={(e) => setTillId(e.target.value)}>
                {tills.map((till) => (
                  <option key={till.id} value={till.id}>
                    {till.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('tillShifts.float')} htmlFor="float" required>
              <Input
                id="float"
                type="number"
                step="0.01"
                min="0"
                value={float}
                onChange={(e) => setFloat(e.target.value)}
              />
            </Field>
            <Button
              disabled={pending || !tillId}
              onClick={() =>
                run(() => openTillShift({ tillId, openingFloatMajor: Number(float || 0) }))
              }
            >
              {pending ? t('common.loading') : t('tillShifts.open')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
