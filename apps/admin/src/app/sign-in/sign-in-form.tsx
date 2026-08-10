'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, CardBody, Field, Input } from '../../components/ui/index';
import { type SignInState, signInAction } from './actions';

export function SignInForm({
  labels,
}: {
  labels: {
    email: string;
    password: string;
    submit: string;
    submitting: string;
    invalid: string;
  };
}) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, {});

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <Field label={labels.email} htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
            />
          </Field>

          <Field label={labels.password} htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? labels.submitting : labels.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
