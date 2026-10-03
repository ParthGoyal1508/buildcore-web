'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  listFuelExceptions,
  recoverFromHireBill,
  recoverFromOperator,
  reviewFuelException,
  type FuelAttribution,
  type FuelException,
} from '@/app/lib/api/plant';
import { FUEL_EXCEPTIONS, MESSAGES } from '@/app/lib/constants';
import { dateLabel, money } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/** How many breaches of one category before the benchmark itself is the likelier fault (T047). */
const BENCHMARK_SUSPECT_THRESHOLD = 5;

/**
 * T047. A whole category breaching at once is a benchmark problem, not fifty operator problems.
 *
 * Counted over what is on screen rather than queried, because the signal is exactly "look at how
 * much of this list is one category". **Open exceptions only**: a category whose benchmark was
 * already corrected leaves its confirmed history behind, and counting that would keep warning about
 * a problem somebody has already fixed.
 *
 * A module-level pure function rather than a `useMemo`, which the React compiler refused to
 * preserve — and it is better here anyway: the rule is about the data, not about this screen.
 */
function suspectBenchmarkIn(
  rows: FuelException[],
): { categoryId: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== 'open') continue;
    const key = row.fuelEntry.equipment.categoryId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [categoryId, count] of counts) {
    if (count >= BENCHMARK_SUSPECT_THRESHOLD) return { categoryId, count };
  }
  return null;
}

/**
 * The fuel exception register (020 FR-001 – FR-006) — `bugs.md` item 13.
 *
 * Two acts, deliberately apart. **Reviewing** records who bears a loss and moves no money.
 * **Recovering** is a second, explicit action against a confirmed exception. Keeping them separate
 * is what lets somebody work down a list without each click costing a vendor or an employee.
 *
 * Every figure shown comes from the server, including the shortfall in litres and rupees. None of
 * it is derived here from `variancePercent`: that is rounded at save time, and a rupee figure
 * worked back from it cannot be reproduced from the readings behind it — which is the figure the
 * operator would be shown when they ask.
 */
export default function FuelExceptions() {
  const [reviewing, setReviewing] = useState<FuelException | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['plant', 'fuel-exceptions'],
    queryFn: () => listFuelExceptions(),
  });

  const rows = data ?? [];
  const suspectCategory = suspectBenchmarkIn(rows);

  const columns: Column<FuelException>[] = [
    {
      key: 'machine',
      header: FUEL_EXCEPTIONS.columnMachine,
      render: (row) => (
        <span>
          {row.fuelEntry.equipment.code} · {row.fuelEntry.equipment.name}
        </span>
      ),
    },
    {
      key: 'date',
      header: FUEL_EXCEPTIONS.columnDate,
      render: (row) => dateLabel(row.fuelEntry.date),
    },
    {
      key: 'actual',
      header: FUEL_EXCEPTIONS.columnActual,
      // Words, not a dash: "no reading" and "ran efficiently" must not look alike.
      render: (row) =>
        row.actualPerHour === null ? (
          <span className="text-xs text-gray-500">
            {FUEL_EXCEPTIONS.noReading}
          </span>
        ) : (
          FUEL_EXCEPTIONS.perHour(row.actualPerHour)
        ),
    },
    {
      key: 'benchmark',
      header: FUEL_EXCEPTIONS.columnBenchmark,
      render: (row) =>
        row.benchmark === null ? (
          <span className="text-xs text-gray-500">
            {FUEL_EXCEPTIONS.noBenchmark}
          </span>
        ) : (
          FUEL_EXCEPTIONS.perHour(row.benchmark)
        ),
    },
    {
      key: 'shortfall',
      header: FUEL_EXCEPTIONS.columnShortfall,
      // Both units on one line (FR-001). Litres are what a site manager argues about; rupees are
      // what anybody is actually asked to bear.
      render: (row) => (
        <span className="whitespace-nowrap">
          {FUEL_EXCEPTIONS.litres(row.shortfallQuantity)} ·{' '}
          {money(row.shortfallAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: FUEL_EXCEPTIONS.columnStatus,
      render: (row) => <StatusCell exception={row} />,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">
          {FUEL_EXCEPTIONS.heading}
        </h2>
        <p className="text-xs text-gray-500">{FUEL_EXCEPTIONS.subheading}</p>
      </div>

      {suspectCategory && (
        // A question, not a verdict. It can also be a bad batch of fuel, and a screen that
        // announces the benchmark is wrong gets a correct exception dismissed.
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {FUEL_EXCEPTIONS.benchmarkSuspect(
            suspectCategory.count,
            rows.find(
              (row) =>
                row.fuelEntry.equipment.categoryId === suspectCategory.categoryId,
            )?.fuelEntry.equipment.name ?? 'this category',
          )}
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? FUEL_EXCEPTIONS.loadFailed : null}
        emptyMessage={FUEL_EXCEPTIONS.empty}
        detail={(row) => <EntryDetail exception={row} />}
        actions={(row) =>
          row.status === 'open' ? (
            <RowAction type="button" onClick={() => setReviewing(row)}>
              {FUEL_EXCEPTIONS.review}
            </RowAction>
          ) : row.status === 'confirmed' ? (
            <RecoveryActions exception={row} />
          ) : null
        }
      />

      {reviewing && (
        <ReviewModal
          exception={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </section>
  );
}

/**
 * The reading behind the exception (FR-002, T040).
 *
 * One fuel entry, because an exception **is** one entry — the table carries a unique index on it.
 * Said plainly rather than dressed up as a list of several, which would imply an aggregation that
 * does not exist and leave somebody looking for the other rows.
 */
function EntryDetail({ exception }: { exception: FuelException }) {
  const { fuelEntry } = exception;
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-xs uppercase tracking-wide text-gray-500">Issued</dt>
        <dd>{FUEL_EXCEPTIONS.litres(fuelEntry.quantity)}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-gray-500">Rate</dt>
        <dd>{money(fuelEntry.rate)}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-gray-500">Cost</dt>
        <dd>{money(fuelEntry.amount)}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-gray-500">
          Over benchmark
        </dt>
        <dd>
          {fuelEntry.variancePercent === null
            ? '—'
            : `${fuelEntry.variancePercent}%`}
        </dd>
      </div>
      {exception.reason && (
        <div className="sm:col-span-4">
          <dt className="text-xs uppercase tracking-wide text-gray-500">
            {FUEL_EXCEPTIONS.reasonLabel}
          </dt>
          <dd>{exception.reason}</dd>
        </div>
      )}
    </dl>
  );
}

/** Where an exception has got to, and — for a recovery — whether any money has actually moved. */
function StatusCell({ exception }: { exception: FuelException }) {
  if (exception.status === 'dismissed') {
    return <span className="text-gray-500">Dismissed</span>;
  }
  if (exception.status === 'open') return <span>Open</span>;

  return (
    <div className="space-y-1">
      <span>Confirmed</span>
      {exception.hireBillDeduction && (
        <p className="text-xs text-gray-600">
          {FUEL_EXCEPTIONS.recoveredHireBill(
            money(exception.hireBillDeduction.amount),
          )}
        </p>
      )}
      {exception.operatorRecovery && (
        /* FR-006, T045. The distinction this whole screen turns on: a recovery raised is not a
           recovery taken. A reviewer who believes the money is already docked will say so to the
           operator, and then either an unapproved recovery never happens or an approved one
           arrives as a surprise. */
        <p className="text-xs text-amber-800">
          {exception.operatorRecovery.status === 'approved'
            ? FUEL_EXCEPTIONS.recoveryApproved
            : FUEL_EXCEPTIONS.recoveryAwaitingApproval}
        </p>
      )}
    </div>
  );
}

/** The two recoveries available on a confirmed exception, and only where they apply. */
function RecoveryActions({ exception }: { exception: FuelException }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['plant', 'fuel-exceptions'] });

  const toHireBill = useMutation({
    mutationFn: () => recoverFromHireBill(exception.id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });
  const toOperator = useMutation({
    mutationFn: () => recoverFromOperator(exception.id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  // FR-004. Absent, not disabled — there is no hirer on an owned machine, and a disabled control
  // advertises a capability that does not exist.
  const hired = exception.fuelEntry.equipment.ownership === 'hired';
  const attribution = exception.attribution;
  const wantsHirer = attribution === 'hirer' || attribution === 'both';
  const wantsOperator = attribution === 'operator' || attribution === 'both';

  return (
    <div className="flex flex-col items-end gap-1">
      {hired && wantsHirer && !exception.hireBillDeduction && (
        <RowAction
          type="button"
          onClick={() => toHireBill.mutate()}
          disabled={toHireBill.isPending}
        >
          {FUEL_EXCEPTIONS.recoverHireBill}
        </RowAction>
      )}
      {wantsOperator && !exception.operatorRecovery && (
        <RowAction
          type="button"
          onClick={() => toOperator.mutate()}
          disabled={toOperator.isPending}
        >
          {FUEL_EXCEPTIONS.recoverOperator}
        </RowAction>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

/**
 * Confirm with an attribution, or dismiss with a reason.
 *
 * The operator choice appears **only when the server asks for it**. It refuses with
 * `FUEL_EXCEPTION_OPERATOR_REQUIRED` and returns the operators who ran the machine that day, so the
 * question is asked exactly when there is a real choice to make: where one person ran it, the
 * server adopts them and forcing a reviewer to retype the only possible answer teaches them to
 * click past the question.
 */
function ReviewModal({
  exception,
  onClose,
}: {
  exception: FuelException;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const employees = useEmployeeNames();
  const [decision, setDecision] = useState<'confirmed' | 'dismissed'>(
    'confirmed',
  );
  const [attribution, setAttribution] = useState<FuelAttribution | ''>('');
  const [operatorEmployeeId, setOperatorEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Filled from the server's refusal, which carries the operators who ran the machine. */
  const [candidates, setCandidates] = useState<string[] | null>(null);

  const hired = exception.fuelEntry.equipment.ownership === 'hired';

  const submit = useMutation({
    mutationFn: () =>
      reviewFuelException(exception.id, {
        status: decision,
        attribution: decision === 'confirmed' ? (attribution as FuelAttribution) : undefined,
        operatorEmployeeId: operatorEmployeeId || undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['plant', 'fuel-exceptions'],
      });
      onClose();
    },
    onError: (err: unknown) => {
      /**
       * The candidates travel in the refusal body, and reading them is the whole point.
       *
       * Without `details` the only way to offer the choice would be to send the reviewer to the
       * logbook to find out who ran the machine — at which point most people pick the name they
       * remember, which is precisely the guess the server refuses to make.
       */
      if (err instanceof ApiError && err.code === 'FUEL_EXCEPTION_OPERATOR_REQUIRED') {
        const offered = err.details?.candidates;
        setCandidates(Array.isArray(offered) ? (offered as string[]) : []);
        setError(
          Array.isArray(offered) && offered.length > 0
            ? FUEL_EXCEPTIONS.operatorRequired
            : FUEL_EXCEPTIONS.operatorNoneRecorded,
        );
        return;
      }
      setError(err instanceof Error ? err.message : MESSAGES.saveFailed);
    },
  });

  const validate = (): string | null => {
    if (decision === 'dismissed' && reason.trim().length === 0) {
      return FUEL_EXCEPTIONS.reasonRequiredToDismiss;
    }
    if (decision === 'confirmed' && !attribution) {
      return FUEL_EXCEPTIONS.attributionRequired;
    }
    return null;
  };

  return (
    <Modal
      title={`${FUEL_EXCEPTIONS.review} — ${exception.fuelEntry.equipment.code}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            disabled={submit.isPending}
            onClick={() => {
              const problem = validate();
              setError(problem);
              if (!problem) submit.mutate();
            }}
          >
            {decision === 'confirmed'
              ? FUEL_EXCEPTIONS.confirm
              : FUEL_EXCEPTIONS.dismiss}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <EntryDetail exception={exception} />

        <SelectField
          id="fuel-decision"
          label="Decision"
          value={decision}
          onChange={(event) =>
            setDecision(event.target.value as 'confirmed' | 'dismissed')
          }
        >
          <option value="confirmed">{FUEL_EXCEPTIONS.confirm}</option>
          <option value="dismissed">{FUEL_EXCEPTIONS.dismiss}</option>
        </SelectField>

        {decision === 'confirmed' && (
          <>
            <SelectField
              id="fuel-attribution"
              label={FUEL_EXCEPTIONS.attribution}
              value={attribution}
              hint={hired ? undefined : FUEL_EXCEPTIONS.ownedNoHirer}
              onChange={(event) =>
                setAttribution(event.target.value as FuelAttribution)
              }
            >
              <option value="">—</option>
              {/* FR-004: the hirer options are absent on an owned machine, and the hint above says
                  why. An option that merely vanishes reads as a bug to somebody who used it
                  yesterday on a hired machine. */}
              {hired && (
                <option value="hirer">{FUEL_EXCEPTIONS.attributionHirer}</option>
              )}
              <option value="operator">
                {FUEL_EXCEPTIONS.attributionOperator}
              </option>
              {hired && (
                <option value="both">{FUEL_EXCEPTIONS.attributionBoth}</option>
              )}
              <option value="neither">
                {FUEL_EXCEPTIONS.attributionNeither}
              </option>
            </SelectField>

            {candidates !== null && candidates.length > 0 && (
              <SelectField
                id="fuel-operator"
                label={FUEL_EXCEPTIONS.operatorLabel}
                value={operatorEmployeeId}
                onChange={(event) => setOperatorEmployeeId(event.target.value)}
              >
                {/* No pre-selection. A defaulted attribution is a recovery raised against whoever
                    happened to be first in a list. */}
                <option value="">—</option>
                {candidates.map((employeeId) => (
                  <option key={employeeId} value={employeeId}>
                    {employees.label(employeeId)}
                  </option>
                ))}
              </SelectField>
            )}
          </>
        )}

        <TextField
          id="fuel-reason"
          label={FUEL_EXCEPTIONS.reasonLabel}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint={
            decision === 'dismissed'
              ? FUEL_EXCEPTIONS.reasonRequiredToDismiss
              : undefined
          }
        />

        <FormError message={error} />
      </div>
    </Modal>
  );
}
