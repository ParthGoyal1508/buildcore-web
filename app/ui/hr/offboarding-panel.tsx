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
import { EXIT_REASONS, HR_MESSAGES, hrLabel } from '@/app/lib/constants';
import { dateLabel, money, periodLabel, rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
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
