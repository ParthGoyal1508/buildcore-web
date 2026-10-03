'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  computeFnf,
  getExit,
  initiateExit,
  processFnf,
  type Employee,
} from '@/app/lib/api/hr-payroll';
import {
  EXIT_REASONS,
  HR_MESSAGES,
  SETTLEMENT_ASSET_COPY,
  hrLabel,
} from '@/app/lib/constants';
import { dateLabel, money, periodLabel, rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import ExitClearance from '@/app/ui/hr/exit-clearance';
import Modal from '@/app/ui/settings/modal';
import StatusBadge from '@/app/ui/status-badge';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Offboarding and Full & Final settlement (005 US11).
 *
 * The settlement is computed on demand and only persisted when processed, which
 * mirrors the backend exactly: an F&F is reviewed and negotiated before it is
 * paid, and storing a draft would create a figure someone could act on before it
 * was agreed. Processing it produces a normal payroll run flagged as F&F, so it
 * inherits the same Draft → Processed → Paid lifecycle rather than a parallel one.
 */
export default function OffboardingPanel({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [lastWorkingDay, setLastWorkingDay] = useState(todayIso());
  const [reason, setReason] = useState<(typeof EXIT_REASONS)[number]>('resignation');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processedRun, setProcessedRun] = useState(false);

  const { data: exit, isLoading: exitLoading } = useQuery({
    queryKey: ['hr', 'exit', employee.id],
    queryFn: () => getExit(employee.id),
    // A 404 here means "no exit initiated", which is a normal state, not a
    // failure — so a missing record must not be retried as though it were one.
    retry: false,
  });

  const { data: fnf, isLoading: fnfLoading } = useQuery({
    queryKey: ['hr', 'fnf', employee.id],
    queryFn: () => computeFnf(employee.id),
    enabled: Boolean(exit),
    retry: false,
  });

  /**
   * Assets still held and not written off (021 FR-018a).
   *
   * Counted from the list rather than from a separate field, so the warning and the rows it refers
   * to cannot disagree. `null` assets means the register could not be asked, which is said in its
   * own sentence rather than counted as zero.
   */
  const stillHeld = (fnf?.assets ?? []).filter(
    (asset) => asset.outcome === 'outstanding',
  ).length;

  const initiate = useMutation({
    mutationFn: () =>
      initiateExit(employee.id, {
        lastWorkingDay,
        reason,
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'exit', employee.id] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const process = useMutation({
    mutationFn: () => processFnf(employee.id),
    onSuccess: () => {
      setProcessedRun(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'exit', employee.id] });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      title={`Offboarding · ${employee.employeeCode}`}
      onClose={onClose}
      wide
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <div className="flex flex-col gap-5">
        <FormError message={error} />

        {exitLoading ? (
          <p className="text-sm text-gray-500" role="status">
            Loading…
          </p>
        ) : !exit ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              initiate.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-gray-600">
              No exit has been initiated for this employee. Recording one is what
              makes a settlement computable.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="exit-lwd"
                label="Last working day"
                type="date"
                value={lastWorkingDay}
                onChange={(event) => setLastWorkingDay(event.target.value)}
              />
              <SelectField
                id="exit-reason"
                label="Reason"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as (typeof EXIT_REASONS)[number])
                }
              >
                {EXIT_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {hrLabel(value)}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField
              id="exit-remarks"
              label="Remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={initiate.isPending}>
                {initiate.isPending ? 'Recording…' : 'Initiate exit'}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">
                  Last working day
                </dt>
                <dd>{dateLabel(exit.lastWorkingDay)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Reason</dt>
                <dd>{hrLabel(exit.reason)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">
                  Settlement run
                </dt>
                <dd>{exit.fnfPayrollRunId ? 'Created' : 'Not yet created'}</dd>
              </div>
            </dl>

            {/*
              What this leaver still owes (021 US4), above the settlement rather than
              beside it. FR-013 makes settlement unavailable while anything is
              outstanding, so the reader needs to know what is outstanding *before*
              reaching a Process button — a clearance below the settlement would be read
              after the decision it is supposed to inform.
            */}
            <div className="border-t border-gray-100 pt-4">
              <ExitClearance employeeId={employee.id} />
            </div>

            {fnfLoading && (
              <p className="text-sm text-gray-500" role="status">
                Computing settlement…
              </p>
            )}

            {fnf && (
              <>
                {/* Warnings come first and verbatim — each one is a reason to
                    stop before processing something irreversible. */}
                {fnf.warnings.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    <ul className="list-inside list-disc">
                      {fnf.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
                  {(
                    [
                      ['Pending salary', fnf.pendingSalary],
                      [
                        `Leave encashment (${money(fnf.leaveEncashment.balanceDays)} days at ${rupees(fnf.leaveEncashment.dailyRate)})`,
                        fnf.leaveEncashment.amount,
                      ],
                      ['Statutory deductions', -fnf.statutoryDeductions],
                      ['Loan recovery', -fnf.loanRecovery],
                      ['Advance recovery', -fnf.advanceRecovery],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between px-4 py-2.5">
                      <dt className="text-gray-600">{label}</dt>
                      <dd
                        className={
                          value < 0 ? 'tabular-nums text-red-700' : 'tabular-nums'
                        }
                      >
                        {money(value)}
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between bg-gray-50 px-4 py-3 font-medium">
                    <dt>Net payable</dt>
                    <dd
                      className={
                        fnf.netPayable < 0
                          ? 'tabular-nums text-red-700'
                          : 'tabular-nums'
                      }
                    >
                      {money(fnf.netPayable)}
                    </dd>
                  </div>
                </dl>

                {/*
                  021 FR-018a — `bugs.md` item 10's "any assets assigned to the employee should
                  appear in the F&F summary", read literally.

                  **Longer than the clearance above on purpose.** The clearance lists what is still
                  outstanding, so an asset returned during the notice period correctly disappears
                  from it. This is the record of how each one *ended*, which is what somebody
                  signing off a settlement needs — and the api used to derive it from the clearance,
                  so a returned asset was missing from both.
                */}
                <section className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-100 px-4 py-2.5">
                    <h4 className="text-sm font-medium text-gray-900">
                      {SETTLEMENT_ASSET_COPY.heading}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {SETTLEMENT_ASSET_COPY.hint}
                    </p>
                  </div>

                  {fnf.assets === null ? (
                    /*
                      Never rendered as "no assets". This is the state where the asset register
                      could not be asked, and reporting it as "held nothing" would have somebody
                      sign off a settlement on a question nobody answered.
                    */
                    <p
                      role="alert"
                      className="bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
                    >
                      {SETTLEMENT_ASSET_COPY.unavailable}
                    </p>
                  ) : fnf.assets.length === 0 ? (
                    <p className="px-4 py-2.5 text-sm text-gray-500">
                      {SETTLEMENT_ASSET_COPY.none}
                    </p>
                  ) : (
                    <>
                      <ul className="divide-y divide-gray-100">
                        {fnf.assets.map((asset) => (
                          <li
                            key={asset.allocationId}
                            className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="break-words text-gray-900">
                                {asset.label}
                              </p>
                              {asset.detail && (
                                <p className="break-words text-xs text-gray-500">
                                  {asset.detail}
                                </p>
                              )}
                              {/* The reason, verbatim. A write-off of company money with no
                                  stated reason is the thing FR-016 exists to prevent. */}
                              {asset.waiverReason && (
                                <p className="mt-0.5 break-words text-xs text-gray-600">
                                  {asset.waiverReason}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <StatusBadge
                                status={
                                  asset.outcome === 'returned'
                                    ? 'asset_returned'
                                    : asset.outcome === 'waived'
                                      ? 'asset_waived'
                                      : 'asset_held'
                                }
                                label={
                                  SETTLEMENT_ASSET_COPY.outcomes[asset.outcome]
                                }
                              />
                              <p className="mt-0.5 text-xs text-gray-500">
                                {asset.outcome === 'returned' &&
                                  asset.returnedOn &&
                                  SETTLEMENT_ASSET_COPY.returnedOn(
                                    asset.returnedOn,
                                  )}
                                {asset.outcome === 'waived' &&
                                  asset.waivedByName &&
                                  SETTLEMENT_ASSET_COPY.waivedBy(
                                    asset.waivedByName,
                                  )}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {stillHeld > 0 && (
                        <p
                          role="alert"
                          className="border-t border-gray-100 bg-amber-50 px-4 py-2 text-xs text-amber-900"
                        >
                          {SETTLEMENT_ASSET_COPY.stillHeldWarning(stillHeld)}
                        </p>
                      )}
                    </>
                  )}

                  {/* FR-018b, said rather than left to be inferred from the absence of a
                      deduction line above. */}
                  <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
                    {SETTLEMENT_ASSET_COPY.noDeduction}
                  </p>
                </section>

                <p className="text-xs text-gray-600">
                  Settled against {periodLabel(fnf.period)}. Processing creates a
                  draft payroll run flagged Full &amp; Final and closes every
                  outstanding loan and advance.
                </p>

                {processedRun ? (
                  <p
                    role="status"
                    className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
                  >
                    Settlement run created as a draft. Review and process it from
                    the Payroll screen — deactivating the employee happens there,
                    not here.
                  </p>
                ) : (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        if (window.confirm(HR_MESSAGES.confirmProcessFnf)) {
                          process.mutate();
                        }
                      }}
                      disabled={process.isPending || Boolean(exit.fnfPayrollRunId)}
                    >
                      {exit.fnfPayrollRunId
                        ? 'Already settled'
                        : process.isPending
                          ? 'Processing…'
                          : 'Create settlement run'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
