'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Alert, Avatar, Button, Card, CardBody, Field, Select } from '../../../components/ui/index';
import { checkInAction } from './check-in';

type Decision = {
  result: 'granted' | 'denied';
  reasonCode: string;
  memberName: string;
  memberSeq: number;
  photoUrl: string | null;
  occupancy: number;
};

/**
 * The front-desk screen: pick a member, get an unmistakable verdict.
 *
 * The verdict is computed and recorded entirely on the server — this component
 * sends a member id and an area, and renders whatever comes back. It has no say
 * in the outcome.
 */
export function CheckInPanel({ members }: { members: { id: string; label: string }[] }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [area, setArea] = useState<'gym' | 'pool' | 'classes'>('gym');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await checkInAction({ memberId, area, direction });
      if (!result.ok) {
        setError(result.error);
        setDecision(null);
        return;
      }
      setDecision(result.data);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}

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

            <Field label={t('access.area')} htmlFor="area" required>
              <Select
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value as typeof area)}
              >
                <option value="gym">{t('access.area_gym')}</option>
                <option value="pool">{t('access.area_pool')}</option>
                <option value="classes">{t('access.area_classes')}</option>
              </Select>
            </Field>

            <Field label={t('access.direction')} htmlFor="direction" required>
              <Select
                id="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
              >
                <option value="in">{t('access.direction_in')}</option>
                <option value="out">{t('access.direction_out')}</option>
              </Select>
            </Field>

            <Button type="submit" size="lg" disabled={pending || !memberId}>
              {pending ? t('common.loading') : t('access.check')}
            </Button>
          </form>
        </CardBody>
      </Card>

      {decision ? <Verdict decision={decision} /> : <IdleCard />}
    </div>
  );
}

function IdleCard() {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] border-dashed p-10 text-center">
      <p className="text-muted text-sm">{t('access.idle')}</p>
    </div>
  );
}

function Verdict({ decision }: { decision: Decision }) {
  const t = useTranslations();
  const granted = decision.result === 'granted';
  const accent = granted ? '#10B981' : '#EF4444';

  return (
    <div
      className="rounded-[var(--radius-card)] border-2 p-8 text-center"
      style={{ borderColor: accent, backgroundColor: `${accent}0D` }}
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 font-bold text-6xl" style={{ color: accent }}>
        {granted ? '✓' : '✗'}
      </div>
      <h2 className="mb-4 font-bold text-3xl" style={{ color: accent }}>
        {granted ? t('access.granted') : t('access.denied')}
      </h2>

      <div className="mb-4 flex flex-col items-center gap-2">
        <Avatar src={decision.photoUrl} name={decision.memberName} size="lg" />
        <p className="font-semibold text-xl">{decision.memberName}</p>
      </div>

      {!granted ? (
        <p className="text-muted text-sm">{t(`access.reason_${decision.reasonCode}`)}</p>
      ) : (
        <p className="text-muted text-sm">
          {t('access.occupancyNow', { count: decision.occupancy })}
        </p>
      )}
    </div>
  );
}
