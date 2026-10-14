'use client';

import {
  EyeSlashIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  confirmPassword,
  PASSWORD_CONFIRMATION_REQUIRED,
  PASSWORD_INCORRECT,
  type PasswordConfirmation,
} from '@/app/lib/api/auth';
import { ApiError } from '@/app/lib/api/client';
import { getCashVisibility, setCashVisibility } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, SETTINGS_PERMISSIONS } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/**
 * The cash visibility toggle (019 FR-012 to FR-015 — `bugs.md` item 16), in Settings only and
 * behind the Super Admin's own password (2026-10-14).
 *
 * The client: "Remove the 'Hide Cash' option from the top navbar and move it into Settings only.
 * This is a sensitive permission, so it should stay hidden by default and only Super Admins should
 * be able to reach it. To reveal it, the Super Admin must enter their own password in Settings.
 * Once the password is verified, the option appears."
 *
 * So this renders in three states:
 *
 * 1. **Nothing**, for anybody who is not a Super Admin (`CROSS_COMPANY_ACCESS`, the same rule the
 *    API applies — never the role's display name). The Settings section is also hidden from them,
 *    so they never learn the control exists.
 * 2. **A password prompt** — and only that. The current setting is not even fetched until the
 *    password is verified, so the screen gives nothing away to whoever is sitting at an unlocked
 *    session.
 * 3. **The toggle**, once `POST /auth/confirm-password` has returned a confirmation. It lasts ten
 *    minutes and lives in this component's state alone — leaving the screen ends it — and every
 *    change sends it, because the API refuses a change without it. When it lapses the API says so
 *    with a coded 403 and this falls back to the prompt.
 *
 * **A display control, and it says so.** Nothing is deleted or altered while it is on, and turning
 * it off restores every figure exactly.
 *
 * **Separate from `CASH_ENTRY`**, which decides who may *record* cash (FR-017a). Nothing here reads
 * or writes the other.
 */
export default function CashVisibility() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState<PasswordConfirmation | null>(
    null,
  );

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const isSuperAdmin =
    user?.permissions.includes(SETTINGS_PERMISSIONS['cash-visibility']) ?? false;

  // Drop the confirmation when it expires, so the toggle hides itself on time rather than
  // waiting for the next click to be refused.
  useEffect(() => {
    if (!confirmation) return;
    const remaining = Date.parse(confirmation.expiresAt) - Date.now();
    const timer = window.setTimeout(
      () => setConfirmation(null),
      Math.max(remaining, 0),
    );
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  const current = useQuery({
    queryKey: ['cash-visibility'],
    queryFn: () => getCashVisibility(),
    // Not before the password: "hidden by default" includes the setting's current state.
    enabled: isSuperAdmin && confirmation !== null,
  });

  const confirm = useMutation({
    mutationFn: () => confirmPassword(password, 'cash-visibility'),
    onSuccess: (result) => {
      setPassword('');
      setError(null);
      setConfirmation(result);
    },
    onError: (err) => {
      setPassword('');
      setError(
        err instanceof ApiError && err.code === PASSWORD_INCORRECT
          ? 'That password is not correct.'
          : err instanceof ApiError
            ? err.message
            : MESSAGES.saveFailed,
      );
    },
  });

  const save = useMutation({
    mutationFn: (hide: boolean) =>
      setCashVisibility(hide, confirmation?.confirmationToken ?? ''),
    onSuccess: (next) => {
      queryClient.setQueryData(['cash-visibility'], next);
      // FR-015. Every open screen is holding figures the server shaped under the old setting, so
      // the whole cache goes rather than a list of the modules that hold cash.
      void queryClient.invalidateQueries();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === PASSWORD_CONFIRMATION_REQUIRED) {
        // Lapsed (or the server restarted with a new key): back to the prompt, saying why.
        setConfirmation(null);
        setError('Your confirmation has expired. Enter your password again.');
        return;
      }
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed);
    },
  });

  if (!isSuperAdmin) return null;

  if (!confirmation) {
    return (
      <section className="max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <LockClosedIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              Confirm it&apos;s you
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Cash visibility is a sensitive setting. Enter your own password to reveal it. The
              confirmation lasts ten minutes and ends when you leave this screen.
            </p>
          </div>
        </div>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!password) return;
            setError(null);
            confirm.mutate();
          }}
        >
          <FormError message={error} />
          <TextField
            id="cash-visibility-password"
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <div>
            <Button
              type="submit"
              intent="read"
              disabled={confirm.isPending || password.length === 0}
              className="gap-2"
            >
              <ShieldCheckIcon className="h-5 w-5" aria-hidden="true" />
              {confirm.isPending ? 'Checking…' : 'Confirm password'}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  const hidden = current.data?.hideCashTransactions ?? false;
  const busy = current.isPending || save.isPending;

  return (
    <section className="max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">
            Cash transaction visibility
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Hides every cash amount across screens, reports and exports. A display setting only —
            nothing is deleted or changed, and switching it off restores every figure exactly as it
            was.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Who may <em>record</em> a payment in cash is a separate permission, set per role.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <FormError message={error} />
        <label className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">
          <span>Hide cash amounts for this company</span>
          {/* A real checkbox drawn as a switch: keyboard and screen-reader behaviour come from the
              input, the look from the sibling span. */}
          <span className="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              role="switch"
              checked={hidden}
              disabled={busy}
              onChange={(event) => {
                setError(null);
                save.mutate(event.target.checked);
              }}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500 peer-disabled:opacity-50"
            />
          </span>
        </label>
        <p className="text-xs text-gray-500">
          Currently:{' '}
          <span className="font-medium text-gray-700">
            {current.isPending ? '…' : hidden ? 'cash amounts are hidden' : 'cash amounts are shown'}
          </span>
          . Confirmed until{' '}
          {new Date(confirmation.expiresAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          .
        </p>
      </div>
    </section>
  );
}
