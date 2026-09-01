'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { changePassword } from '@/app/lib/api/auth';
import { passwordRules } from '@/app/lib/api/account-creation';
import { ApiError } from '@/app/lib/api/client';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/**
 * The mandatory password change (010 FR-017c).
 *
 * Until this existed, an account created with an admin-set password could sign in
 * and reach nothing: the server refuses every non-exempt request until the password
 * is replaced, and this screen was a placeholder explaining that no form existed.
 *
 * On success the user continues on the *same* session — the backend clears the flag
 * in the same write as the new hash, and its refusal reads live account state rather
 * than the token, so nothing needs re-issuing.
 */
export default function ChangePasswordForm() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unmet = passwordRules.filter((rule) => !rule.test(newPassword));
  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length > 0 &&
    unmet.length === 0 &&
    !mismatch;

  const submit = useMutation({
    mutationFn: () => changePassword({ oldPassword, newPassword }),
    onSuccess: () => {
      // Straight on, not back to login: the session is still valid and the refusal
      // that sent them here has already stopped. Bouncing to /login would read as
      // the change having failed.
      router.replace(ROUTES.dashboard);
    },
    onError: (err: unknown) =>
      setError(
        err instanceof ApiError
          ? // The backend distinguishes a wrong current password from a rejected
            // new one; its message is more specific than anything generic here.
            err.message
          : MESSAGES.saveFailed,
      ),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) submit.mutate();
      }}
    >
      <FormError message={error} />

      <TextField
        id="current-password"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
      />

      <TextField
        id="new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />

      {/* Each rule shown separately, and only once the user has started typing:
          one flat "invalid password" leaves them guessing which part is wrong. */}
      {newPassword.length > 0 && (
        <ul className="space-y-1 text-xs">
          {passwordRules.map((rule) => {
            const met = rule.test(newPassword);
            return (
              <li
                key={rule.label}
                className={clsx(met ? 'text-green-700' : 'text-gray-500')}
              >
                {met ? '✓' : '•'} {rule.label}
              </li>
            );
          })}
        </ul>
      )}

      <TextField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        error={mismatch ? 'The two passwords do not match.' : undefined}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <Button type="submit" disabled={!canSubmit || submit.isPending}>
        {submit.isPending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
