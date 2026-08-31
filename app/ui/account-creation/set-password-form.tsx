'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  passwordRules,
  setPassword,
  setPasswordSchema,
  validateInvite,
} from '@/app/lib/api/account-creation';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/** Each reason needs a different next step, so they are not collapsed into one
 * "invalid link" message — a recipient who can ask for a resend should be told to. */
const INVALID_REASONS: Record<string, string> = {
  expired:
    'This invite link has expired. Ask your administrator to send a new one.',
  consumed:
    'This invite link has already been used. If you have not set a password yet, ask your administrator to send a new one.',
  not_found:
    'This invite link is not valid. Check that you copied the whole link from your email.',
};

export default function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: validation,
    isPending: checking,
    isError: checkFailed,
  } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => validateInvite(token),
    // A spent link cannot become valid again, so there is nothing to retry into.
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => setPassword(token, password),
    onSuccess: () => router.push('/login?activated=1'),
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Could not set your password.'),
  });

  if (checking) {
    return (
      <p role="status" className="text-sm text-gray-600">
        Checking your invite link…
      </p>
    );
  }

  if (checkFailed) {
    return (
      <p role="alert" className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-800">
        We could not check this link just now. Please try again in a moment.
      </p>
    );
  }

  if (!validation?.valid) {
    const reason = validation && 'reason' in validation ? validation.reason : 'not_found';
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-800">
        {INVALID_REASONS[reason] ?? INVALID_REASONS.not_found}
      </p>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = setPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    // Checked here rather than in the schema: a mismatch is about this form, not
    // about whether the password itself is acceptable.
    if (password !== confirm) {
      setError('Both passwords must match.');
      return;
    }
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-gray-600">
        Setting the password for <strong>{validation.email}</strong>.
      </p>

      <TextField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
      />

      {/* Live, per-rule feedback rather than one message after submitting: someone
          choosing a password should be able to see which requirement is still
          unmet while they type. */}
      <ul className="space-y-1 text-sm">
        {passwordRules.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.label}
              className={met ? 'text-green-700' : 'text-gray-500'}
            >
              <span aria-hidden="true">{met ? '✓' : '○'}</span>{' '}
              <span>{rule.label}</span>
              <span className="sr-only">{met ? ' — met' : ' — not yet met'}</span>
            </li>
          );
        })}
      </ul>

      <TextField
        id="confirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <FormError message={error} />

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Setting password…' : 'Set password and continue'}
      </Button>
    </form>
  );
}
