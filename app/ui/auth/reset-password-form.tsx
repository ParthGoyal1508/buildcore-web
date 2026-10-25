'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { resetPassword, validateResetLink } from '@/app/lib/api/auth';
import { passwordRules } from '@/app/lib/api/account-creation';
import { ApiError } from '@/app/lib/api/client';
import { ROUTES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import PasswordRules from '@/app/ui/password-rules';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/** Each reason has a different next step, so they are not collapsed into one "invalid link". */
const INVALID_REASONS: Record<string, string> = {
  expired: 'This reset link has expired. Ask for a new one below.',
  consumed:
    'This reset link has already been used, or a newer one has been sent. Use the most recent email, or ask for a new link.',
  not_found:
    'This reset link is not valid. Check that you opened the whole link from your email.',
};

/**
 * Choosing a new password from an emailed link (029 FR-012, FR-013).
 *
 * On success every session for the account has ended — this browser's too — so it ends on a
 * sign-in prompt rather than signing anyone in. That is also what works for the installed app:
 * on iOS a link from Mail opens in Safari, not in the home-screen app, and the two do not share
 * a session, so the app has to be signed into separately whatever this page did.
 */
export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: validation,
    isPending: checking,
    isError: checkFailed,
    refetch,
  } = useQuery({
    queryKey: ['reset-link', token],
    queryFn: () => validateResetLink(token),
    // A spent link cannot become valid again; a transport failure gets a button instead.
    retry: false,
    // Never re-asked on refocus: the answer cannot improve, and a tab left open would
    // otherwise keep re-sending a live credential.
    refetchOnWindowFocus: false,
  });

  const submit = useMutation({
    mutationFn: () => resetPassword(token, password),
    onError: (err: unknown) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not save that just now. Check your connection and try again.',
      ),
  });

  if (submit.isSuccess) {
    return (
      <div role="status" className="space-y-3">
        <p className="rounded-md bg-green-50 px-3 py-3 text-green-800">
          Your password has been changed, and you have been signed out on every device.
        </p>
        <p>
          Sign in with your new password. If you use the Tirupati Groups app on your phone, open it
          and sign in there too.
        </p>
        <Link
          href={`${ROUTES.login}?reset=1`}
          className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:h-10"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  if (checking) {
    return (
      <p role="status" className="text-gray-600">
        Checking your reset link…
      </p>
    );
  }

  if (checkFailed) {
    return (
      <div role="alert" className="space-y-3">
        <p className="rounded-md bg-amber-50 px-3 py-3 text-amber-800">
          We could not check this link just now — you may be offline.
        </p>
        <Button type="button" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!validation?.valid) {
    const reason = validation && 'reason' in validation ? validation.reason : 'not_found';
    return (
      <div role="alert" className="space-y-3">
        <p className="rounded-md bg-red-50 px-3 py-3 text-red-800">
          {INVALID_REASONS[reason] ?? INVALID_REASONS.not_found}
        </p>
        <Link href={ROUTES.forgotPassword} className="text-brand-600 hover:underline">
          Send me a new link
        </Link>
      </div>
    );
  }

  const unmet = passwordRules.some((rule) => !rule.test(password));
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (unmet) {
          setError(
            'Password must be at least 8 characters and include an uppercase letter and a number.',
          );
          return;
        }
        if (password !== confirm) {
          setError('Both passwords must match.');
          return;
        }
        submit.mutate();
      }}
    >
      <FormError message={error} />
      <TextField
        id="new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordRules value={password} />
      <TextField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        enterKeyHint="done"
        value={confirm}
        error={mismatch ? 'The two passwords do not match.' : undefined}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button type="submit" disabled={submit.isPending}>
        {submit.isPending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
