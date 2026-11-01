'use client';

import { LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  confirmPassword,
  getFaceUnlock,
  PASSWORD_CONFIRMATION_REQUIRED,
  PASSWORD_INCORRECT,
  type PasswordConfirmation,
} from '@/app/lib/api/auth';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompany } from '@/app/lib/api/company-selection';
import { getCashVisibility, setCashVisibility } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, SETTINGS_PERMISSIONS } from '@/app/lib/constants';
import { clockTime } from '@/app/lib/format';
import { Button, TextButton } from '@/app/ui/button';
import QueryError from '@/app/ui/query-error';
import {
  compactSelectClass,
  FormError,
  TextField,
} from '@/app/ui/settings/form-fields';
import {
  FACE_UNLOCK_QUERY,
  FaceGate,
  FaceUnlockRow,
} from '@/app/ui/settings/face-unlock';
import { TABLE } from '@/app/ui/table';
import { toast } from '@/app/ui/toast';

/**
 * App Settings (2026-11-01): the cash visibility switch, disguised.
 *
 * The client: nothing on screen may say a cash-hiding feature exists. So the page is a table of
 * everyday display preferences, and one row of it — **"Slate theme"** — is the switch: on means
 * cash is hidden for the selected company (038: gone from every screen, report, total and export,
 * and refused for everyone until it is turned off; nothing is deleted). Every other row is a
 * decoy: it works, and is remembered on this device, but changes nothing else.
 *
 * Still Super Admin only (`CROSS_COMPANY_ACCESS`) and behind the Super Admin's own password
 * (2026-10-14): nothing — not even the switch's state — is fetched until the password is
 * verified, the confirmation lasts ten minutes in this component's state alone, and the API
 * refuses a change without it. Since 054 a registered face can stand in for the password (the
 * "Face unlock" row registers it; the password stays as the fallback).
 */

type Confirmation = PasswordConfirmation & { method: 'password' | 'face' };

type Decoy =
  | {
      key: string;
      label: string;
      group: string;
      hint: string;
      kind: 'switch';
      initial: boolean;
    }
  | {
      key: string;
      label: string;
      group: string;
      hint: string;
      kind: 'select';
      options: string[];
      initial: string;
    };

const DECOYS: Decoy[] = [
  {
    key: 'compactRows',
    label: 'Compact table rows',
    group: 'Display',
    hint: 'Fit more rows on screen in every list.',
    kind: 'switch',
    initial: false,
  },
  {
    key: 'stickyHeaders',
    label: 'Sticky table headers',
    group: 'Display',
    hint: 'Keep column names in view while scrolling.',
    kind: 'switch',
    initial: true,
  },
  {
    key: 'rowsPerPage',
    label: 'Rows per page',
    group: 'Display',
    hint: 'How many records a list shows at once.',
    kind: 'select',
    options: ['10', '25', '50', '100'],
    initial: '25',
  },
  {
    key: 'dateFormat',
    label: 'Date format',
    group: 'Regional',
    hint: 'How dates appear on screen.',
    kind: 'select',
    options: ['DD-MM-YYYY', 'DD MMM YYYY', 'YYYY-MM-DD'],
    initial: 'DD-MM-YYYY',
  },
  {
    key: 'numberFormat',
    label: 'Number grouping',
    group: 'Regional',
    hint: 'Lakh/crore or thousand/million separators.',
    kind: 'select',
    options: ['Indian (12,34,567)', 'International (1,234,567)'],
    initial: 'Indian (12,34,567)',
  },
  {
    key: 'weekStart',
    label: 'Week starts on',
    group: 'Regional',
    hint: 'First day shown in calendars.',
    kind: 'select',
    options: ['Monday', 'Sunday'],
    initial: 'Monday',
  },
  {
    key: 'reduceMotion',
    label: 'Reduce animations',
    group: 'Appearance',
    hint: 'Fewer transitions when panels open and close.',
    kind: 'switch',
    initial: false,
  },
  {
    key: 'focusRings',
    label: 'High-contrast focus outline',
    group: 'Appearance',
    hint: 'A bolder outline on the focused control.',
    kind: 'switch',
    initial: false,
  },
  {
    key: 'landingPage',
    label: 'Landing page',
    group: 'Navigation',
    hint: 'Where you arrive after signing in.',
    kind: 'select',
    options: ['Dashboard', 'Projects', 'Inventory', 'HR & Payroll'],
    initial: 'Dashboard',
  },
  {
    key: 'sidebarCollapsed',
    label: 'Start with sidebar collapsed',
    group: 'Navigation',
    hint: 'Open screens with the menu folded away.',
    kind: 'switch',
    initial: false,
  },
  {
    key: 'tooltips',
    label: 'Icon tooltips',
    group: 'Navigation',
    hint: 'Show a label when hovering over an icon.',
    kind: 'switch',
    initial: true,
  },
  {
    key: 'exportFormat',
    label: 'Default export format',
    group: 'Exports',
    hint: 'Format chosen first when exporting a list.',
    kind: 'select',
    options: ['Excel (.xlsx)', 'CSV', 'PDF'],
    initial: 'Excel (.xlsx)',
  },
  {
    key: 'printHeader',
    label: 'Company header on prints',
    group: 'Exports',
    hint: 'Letterhead at the top of printed lists.',
    kind: 'switch',
    initial: true,
  },
];

/** The disguised row goes after this many decoys, mid-table. */
const SLATE_AFTER = 7;
const STORAGE_KEY = 'buildcore.appSettings';

type DecoyValues = Record<string, boolean | string>;

function loadDecoys(): DecoyValues {
  const values: DecoyValues = Object.fromEntries(
    DECOYS.map((d) => [d.key, d.initial]),
  );
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { ...values, ...saved };
  } catch {
    return values;
  }
}

/** A real checkbox drawn as a switch: keyboard and screen-reader behaviour come from the input. */
function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500 peer-disabled:opacity-50"
      />
    </label>
  );
}

export default function AppSettings() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  // Lazily, not in an effect: the table renders only after the password, so always in a browser.
  const [decoys, setDecoys] = useState<DecoyValues>(() =>
    typeof window === 'undefined' ? {} : loadDecoys(),
  );

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const isSuperAdmin =
    user?.permissions.includes(SETTINGS_PERMISSIONS['app-settings']) ?? false;
  // The API applies the switch to the selected company, or the caller's own when none is.
  const company = useSelectedCompany();
  const companyLabel = company?.name ?? 'your company';

  // Drop the confirmation when it expires, so the table hides itself on time.
  useEffect(() => {
    if (!confirmation) return;
    const remaining = Date.parse(confirmation.expiresAt) - Date.now();
    const timer = window.setTimeout(
      () => setConfirmation(null),
      Math.max(remaining, 0),
    );
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  // Asked before the unlock: it says only whether to open the camera or the password field.
  const face = useQuery({
    queryKey: FACE_UNLOCK_QUERY,
    queryFn: () => getFaceUnlock('cash-visibility'),
    enabled: isSuperAdmin,
  });
  const faceGate = face.data?.enrolled === true && !usePassword;

  const current = useQuery({
    queryKey: ['cash-visibility'],
    queryFn: () => getCashVisibility(),
    enabled: isSuperAdmin && confirmation !== null,
  });

  const confirm = useMutation({
    mutationFn: () => confirmPassword(password, 'cash-visibility'),
    onSuccess: (result) => {
      setPassword('');
      setError(null);
      setConfirmation({ ...result, method: 'password' });
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
      toast.success('Settings saved.');
      // Every open screen holds figures shaped under the old setting, the cash policy included.
      void queryClient.invalidateQueries();
    },
    onError: (err) => {
      if (
        err instanceof ApiError &&
        err.code === PASSWORD_CONFIRMATION_REQUIRED
      ) {
        setConfirmation(null);
        setError("Your confirmation has expired. Confirm it's you again.");
        return;
      }
      setError(errorMessage(err, MESSAGES.saveFailed));
    },
  });

  const setDecoy = (key: string, value: boolean | string) => {
    const next = { ...decoys, [key]: value };
    setDecoys(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage refused (private mode): the choice lasts for this visit.
    }
    toast.success('Settings saved.');
  };

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
              {faceGate
                ? 'Look at the camera to change app settings.'
                : 'Enter your password to change app settings.'}{' '}
              The confirmation lasts ten minutes and ends when you leave this
              screen.
            </p>
          </div>
        </div>
        {faceGate ? (
          <FaceGate
            onConfirmed={(result) => {
              setError(null);
              setConfirmation({ ...result, method: 'face' });
            }}
          />
        ) : (
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
              id="app-settings-password"
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
        )}
        {face.data?.enrolled && (
          <TextButton
            className="mt-3"
            onClick={() => {
              setError(null);
              setUsePassword((v) => !v);
            }}
          >
            {faceGate ? 'Use password instead' : 'Use face unlock instead'}
          </TextButton>
        )}
      </section>
    );
  }

  // Nothing is offered until the real setting has loaded: a failed load must not show a working
  // switch one click from a state nobody read (036 C13).
  if (current.isError) {
    return (
      <section className="max-w-3xl">
        <QueryError
          error={current.error}
          onRetry={current.refetch}
          fallback="Settings could not be loaded."
        />
      </section>
    );
  }

  const busy = current.isPending || save.isPending;
  const slate = current.data?.hideCashTransactions ?? false;

  const decoyRow = (d: Decoy) => {
    const value = decoys[d.key] ?? d.initial;
    return (
      <tr key={d.key} className={TABLE.row}>
        <td className={TABLE.td}>
          <div className="font-medium text-gray-900">{d.label}</div>
          <div className="text-xs text-gray-500">{d.hint}</div>
        </td>
        <td className={`${TABLE.td} text-gray-600`}>{d.group}</td>
        <td className={`${TABLE.td} w-48`}>
          {d.kind === 'switch' ? (
            <Switch
              label={d.label}
              checked={value === true}
              onChange={(next) => setDecoy(d.key, next)}
            />
          ) : (
            <select
              aria-label={d.label}
              className={compactSelectClass}
              value={String(value)}
              onChange={(event) => setDecoy(d.key, event.target.value)}
            >
              {d.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          )}
        </td>
      </tr>
    );
  };

  return (
    <section className="flex max-w-3xl flex-col gap-3">
      <FormError message={error} />
      <div className={TABLE.wrap}>
        <table className={`${TABLE.table} w-full`}>
          <thead className={TABLE.thead}>
            <tr>
              <th scope="col" className={TABLE.th}>
                Setting
              </th>
              <th scope="col" className={TABLE.th}>
                Group
              </th>
              <th scope="col" className={TABLE.th}>
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {DECOYS.slice(0, SLATE_AFTER).map(decoyRow)}
            <tr className={TABLE.row}>
              <td className={TABLE.td}>
                <div className="font-medium text-gray-900">Slate theme</div>
                <div className="text-xs text-gray-500">
                  A cooler, softer palette for long sessions.
                </div>
              </td>
              <td className={`${TABLE.td} text-gray-600`}>Appearance</td>
              <td className={`${TABLE.td} w-48`}>
                <Switch
                  label="Slate theme"
                  checked={slate}
                  disabled={busy || !current.data}
                  onChange={(next) => {
                    setError(null);
                    save.mutate(next);
                  }}
                />
              </td>
            </tr>
            {DECOYS.slice(SLATE_AFTER).map(decoyRow)}
            <FaceUnlockRow
              status={face.data}
              confirmation={confirmation}
              rowClass={TABLE.row}
              cellClass={TABLE.td}
            />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Settings for {companyLabel}. Unlocked until{' '}
        {clockTime(confirmation.expiresAt)}.
      </p>
    </section>
  );
}
