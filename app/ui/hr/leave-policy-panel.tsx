'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  downloadLeaveOpeningTemplate,
  getLeavePolicy,
  importLeaveOpening,
  runLeaveCredits,
  saveLeavePolicy,
  type LeavePolicyRow,
} from '@/app/lib/api/hr-payroll';
import { blobToBase64 } from '@/app/lib/api/my-workspace';
import { saveBlob } from '@/app/lib/download-file';
import { financialYearOf } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

const TYPE_LABEL: Record<LeavePolicyRow['leaveType'], string> = {
  earned: 'Earned leave',
  casual: 'Casual leave',
  sick: 'Sick leave',
};

const cell =
  'rounded-md border border-gray-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:bg-gray-100';

/**
 * The company's leave policy (2026-10-16: "create a screen with typical defaults where HR can edit
 * it").
 *
 * Until saved, the rows are the built-in defaults — EL 18 a year credited monthly and carried
 * forward up to 45, CL 8 and SL 7 credited on 1 April and lapsing — and leave is credited on them
 * anyway, so nobody waits on HR to open this screen. Crediting runs every night; "Credit leave now"
 * runs it at once (after a change, say), and is safe to press twice.
 */
export default function LeavePolicyPanel() {
  const companyId = useSelectedCompanyId();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ['hr', 'leavePolicy', companyId],
    queryFn: () => getLeavePolicy(companyId),
  });

  if (isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Could not load the leave policy.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <PolicyForm
        // Keyed on the company, not the data: the refetch after a save must not remount the form
        // and wipe its "saved" confirmation.
        key={companyId ?? 'own'}
        initial={data}
        onSaved={() =>
          void queryClient.invalidateQueries({
            queryKey: ['hr', 'leavePolicy'],
          })
        }
      />
      <CreditNow />
      <OpeningImport />
    </div>
  );
}

function PolicyForm({
  initial,
  onSaved,
}: {
  initial: LeavePolicyRow[];
  onSaved: () => void;
}) {
  const companyId = useSelectedCompanyId();
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const usingDefaults = initial.every((row) => row.isDefault);

  const save = useMutation({
    mutationFn: () =>
      saveLeavePolicy(
        companyId,
        rows.map((row) => ({
          leaveType: row.leaveType,
          annualDays: row.annualDays,
          creditMode: row.creditMode,
          carryForward: row.carryForward,
          carryForwardCap: row.carryForward ? row.carryForwardCap : null,
          prorateJoiners: row.prorateJoiners,
        })),
      ),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      onSaved();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not save the policy.',
      ),
  });

  const update = (index: number, patch: Partial<LeavePolicyRow>) => {
    setSaved(false);
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Leave policy</h2>
        <p className="text-sm text-gray-600">
          How many days each employee gets a year, and how they are credited.
          {usingDefaults &&
            ' These are typical defaults — change them to match your policy and save.'}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="px-3 py-2">Leave type</th>
              <th className="px-3 py-2">Days a year</th>
              <th className="px-3 py-2">Credited</th>
              <th className="px-3 py-2">Carry forward</th>
              <th className="px-3 py-2">Carry-forward cap</th>
              <th className="px-3 py-2">Prorate new joiners</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.leaveType}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-3 py-2 font-medium text-gray-900">
                  {TYPE_LABEL[row.leaveType]}
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${TYPE_LABEL[row.leaveType]} days a year`}
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    value={row.annualDays}
                    onChange={(event) =>
                      update(index, { annualDays: Number(event.target.value) })
                    }
                    className={`${cell} w-20`}
                  />
                  {row.creditMode === 'monthly' && row.annualDays > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      {Math.round((row.annualDays / 12) * 100) / 100} a month
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`${TYPE_LABEL[row.leaveType]} credited`}
                    value={row.creditMode}
                    onChange={(event) =>
                      update(index, {
                        creditMode: event.target
                          .value as LeavePolicyRow['creditMode'],
                      })
                    }
                    className={cell}
                  >
                    <option value="monthly">Monthly (1st of each month)</option>
                    <option value="yearly">Yearly (on 1 April)</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${TYPE_LABEL[row.leaveType]} carry forward`}
                    type="checkbox"
                    checked={row.carryForward}
                    onChange={(event) =>
                      update(index, { carryForward: event.target.checked })
                    }
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${TYPE_LABEL[row.leaveType]} carry-forward cap`}
                    type="number"
                    min={0}
                    step={0.5}
                    disabled={!row.carryForward}
                    placeholder="No cap"
                    value={row.carryForwardCap ?? ''}
                    onChange={(event) =>
                      update(index, {
                        carryForwardCap:
                          event.target.value === ''
                            ? null
                            : Number(event.target.value),
                      })
                    }
                    className={`${cell} w-24`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`${TYPE_LABEL[row.leaveType]} prorate new joiners`}
                    type="checkbox"
                    checked={row.prorateJoiners}
                    disabled={row.creditMode === 'monthly'}
                    title={
                      row.creditMode === 'monthly'
                        ? 'Monthly credit starts from the joining month anyway'
                        : undefined
                    }
                    onChange={(event) =>
                      update(index, { prorateJoiners: event.target.checked })
                    }
                    className="h-4 w-4"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Leave without pay has no balance and is not credited. Unused days of a
        type that does not carry forward lapse on 31 March. Raising a yearly
        allowance tops up this year&apos;s credit for everyone the next time
        leave is credited; lowering one takes back nothing already given. A
        change to a monthly allowance applies from the next month&apos;s credit.
      </p>
      <FormError message={error} />
      {saved && (
        <p className="text-sm text-green-700" role="status">
          Policy saved. Use “Credit leave now” to apply it today, or it runs
          tonight.
        </p>
      )}
      <Button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        Save policy
      </Button>
    </section>
  );
}

function CreditNow() {
  const companyId = useSelectedCompanyId();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => runLeaveCredits(companyId),
    onSuccess: (result) => {
      setError(null);
      setMessage(
        result.entries === 0
          ? 'Everyone is up to date — nothing was due.'
          : `Credited ${result.days} days to ${result.employees} employee${result.employees === 1 ? '' : 's'}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['hr', 'leaveBalances'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not credit leave.',
      ),
  });
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">Crediting</h2>
      <p className="text-sm text-gray-600">
        Leave is credited automatically every night — each month&apos;s share on
        the 1st, yearly leave on 1 April, and carry-forward at the start of the
        year. New joiners are credited from the month they join.
      </p>
      <FormError message={error} />
      {message && (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      )}
      <SecondaryButton
        type="button"
        disabled={run.isPending}
        onClick={() => run.mutate()}
      >
        {run.isPending ? 'Crediting…' : 'Credit leave now'}
      </SecondaryButton>
    </section>
  );
}

function OpeningImport() {
  const companyId = useSelectedCompanyId();
  const queryClient = useQueryClient();
  const financialYear = financialYearOf();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) =>
      importLeaveOpening(companyId, financialYear, await blobToBase64(file)),
    onSuccess: (result) => {
      setError(null);
      setMessage(
        `${result.applied} balance${result.applied === 1 ? '' : 's'} set.` +
          (result.unknownCodes.length > 0
            ? ` Not found: ${result.unknownCodes.join(', ')}.`
            : ''),
      );
      void queryClient.invalidateQueries({ queryKey: ['hr', 'leaveBalances'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not import the sheet.',
      ),
  });

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">
        Opening balances ({financialYear})
      </h2>
      <p className="text-sm text-gray-600">
        When you start using the app, bring in each employee&apos;s leave
        balance from your records so nobody starts at zero. Download the sheet
        (it lists every active employee), fill in the Earned, Casual and Sick
        columns, and upload it. Importing <strong>sets</strong> the opening
        balance — re-uploading a corrected sheet replaces it rather than adding.
      </p>
      <FormError message={error} />
      {message && (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { blob, filename } = await downloadLeaveOpeningTemplate(
                companyId,
                financialYear,
              );
              saveBlob(
                blob,
                filename ?? `Leave opening balances ${financialYear}.xlsx`,
              );
            } catch (err) {
              setError(
                err instanceof ApiError
                  ? err.message
                  : 'Could not download the sheet.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Download sheet
        </SecondaryButton>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:outline focus-within:outline-2 focus-within:outline-blue-500">
          {upload.isPending ? 'Importing…' : 'Upload filled sheet'}
          <input
            type="file"
            accept=".xlsx"
            className="sr-only"
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) upload.mutate(file);
            }}
          />
        </label>
      </div>
    </section>
  );
}
