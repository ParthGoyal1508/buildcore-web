'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { requestPasswordReset } from '@/app/lib/api/auth';
import { ApiError } from '@/app/lib/api/client';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/**
 * Forgot Password (029 FR-010).
 *
 * The confirmation is worded the same whatever the API found, because the API answers the same
 * whatever it found: saying "no account with that email" here would tell anyone typing addresses
 * which ones belong to staff.
 */
export default function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => requestPasswordReset(identifier),
    onError: (err: unknown) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not send that just now. Check your connection and try again.',
      ),
  });

  if (request.isSuccess) {
    return (
      <div role="status" className="space-y-3">
        <p className="rounded-md bg-green-50 px-3 py-3 text-green-800">
          If <strong>{identifier.trim()}</strong> matches an active account, we have emailed
          it a link to reset the password.
        </p>
        <p>
          The link works once and expires in 30 minutes. Nothing arrived? Check your spam
          folder, or ask your administrator — they can send you a link or a temporary
          password.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (!identifier.trim()) {
          setError('Enter the email address or username you sign in with.');
          return;
        }
        request.mutate();
      }}
    >
      <p>
        Enter the email address or username you sign in with, and we will email you a link to
        choose a new password.
      </p>
      <FormError message={error} />
      <TextField
        id="identifier"
        label="Email or username"
        type="text"
        // `username` lets a password manager offer the saved login; `email` would hide it for
        // people who sign in with a username.
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="email"
        enterKeyHint="send"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />
      <Button type="submit" disabled={request.isPending}>
        {request.isPending ? 'Sending…' : 'Email me a reset link'}
      </Button>
    </form>
  );
}
