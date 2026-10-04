'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { getCashVisibility, setCashVisibility } from '@/app/lib/api/settings';
import { getCurrentUser, hasWrite } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import { FormError } from '@/app/ui/settings/form-fields';

/**
 * The cash visibility toggle (019 FR-012 to FR-015) — `bugs.md` item 16.
 *
 * **Present only for a `COMPANY_SETTINGS` holder at write level, and absent otherwise** — not
 * disabled. FR-012's "restrict who can change the setting" is that permission, and a disabled
 * switch would tell every reader in the company that the figures they are looking at can be
 * concealed, which is a thing worth not advertising.
 *
 * **A display control, and it says so.** Nothing is deleted or altered while it is on, and turning
 * it off restores every figure exactly. Somebody flipping this needs to know that before they flip
 * it, because the alternative reading — that it deletes or locks something — is the one that stops
 * people using a feature they asked for.
 *
 * **Separate from `CASH_ENTRY`**, which decides who may *record* cash (FR-017a). Two controls
 * answering different questions: this one is company-wide and about display, that one is per-caller
 * and about capability. Nothing here reads or writes the other, and nothing should — a screen that
 * conflated them would reintroduce the company-wide entry block the design rejected.
 */
export default function CashVisibility({
  variant = 'panel',
}: {
  /**
   * `panel` for the Settings screen, `compact` for the shell header.
   *
   * One component in two shapes rather than two components, because it is one control: the client
   * asked for it "in the main menu", and Settings is where somebody goes looking for it. Two
   * implementations would be two chances for them to disagree about what the switch currently says.
   */
  variant?: 'panel' | 'compact';
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const mayChange = hasWrite(user, 'COMPANY_SETTINGS');

  const current = useQuery({
    queryKey: ['cash-visibility'],
    queryFn: () => getCashVisibility(),
    // Not fetched at all for somebody who cannot change it. The figures they see are already
    // shaped by the server; asking the question would be a request whose answer changes nothing.
    enabled: mayChange,
  });

  const save = useMutation({
    mutationFn: (hide: boolean) => setCashVisibility(hide),
    onSuccess: (next) => {
      queryClient.setQueryData(['cash-visibility'], next);
      // FR-015. Every open screen is holding figures the server shaped under the old setting, so
      // the whole cache goes rather than a list of the modules that hold cash: the API decides per
      // row from `paymentMode` and keeps no screen list, and a list kept here is how the two drift.
      void queryClient.invalidateQueries();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  if (!mayChange) return null;

  const hidden = current.data?.hideCashTransactions ?? false;
  const busy = current.isPending || save.isPending;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          save.mutate(!hidden);
        }}
        // `aria-pressed` and not a checkbox: this is a toggle button, and a screen reader should
        // hear its state rather than infer it from the label changing.
        aria-pressed={hidden}
        title={
          hidden
            ? 'Cash amounts are hidden. Click to show them.'
            : 'Cash amounts are visible. Click to hide them.'
        }
        className="hidden items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 sm:flex"
      >
        <span aria-hidden="true">{hidden ? '🙈' : '👁'}</span>
        {hidden ? 'Cash hidden' : 'Hide cash'}
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-gray-100 p-4">
      <h2 className="text-sm font-semibold text-gray-900">
        Cash transaction visibility
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Hides every cash amount across screens, reports and exports. A display setting
        only — nothing is deleted or changed, and switching it off restores every figure
        exactly as it was.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Who may <em>record</em> a payment in cash is a separate permission, set per role.
      </p>
      <div className="mt-3">
        <FormError message={error} />
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={hidden}
            disabled={busy}
            onChange={(event) => {
              setError(null);
              save.mutate(event.target.checked);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
          Hide cash amounts for this company
        </label>
      </div>
    </section>
  );
}
