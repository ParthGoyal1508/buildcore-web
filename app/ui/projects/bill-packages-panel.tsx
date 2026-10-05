'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  BILL_DIRECTIONS,
  type BillDirection,
  composeBillPackage,
  listBillPackages,
} from '@/app/lib/api/bill-packages';
import { ROUTES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import StatusBadge from '@/app/ui/status-badge';

const DIRECTION_LABEL: Record<BillDirection, string> = {
  to_client: 'To the client',
  to_subcontractor: 'To a subcontractor',
};

/**
 * Every running-account bill package on a project, and the form that opens the next (024 Story 3).
 *
 * ## The period is two dates, and that is not a formality
 *
 * The client's own cycle runs the 21st to the 20th, so a month is **not derivable** from either
 * date — both are stored, both inclusive. A date picker offering "January" would have to guess
 * which convention applies and would be wrong for this client every month.
 *
 * ## Composing twice is safe
 *
 * The same project, direction and period opened again returns the **existing** package rather than
 * creating a second, because a period billed twice is measurement claimed twice. So the button does
 * not need to be disabled after use, and a double click cannot produce two bills.
 */
export default function BillPackagesPanel({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<BillDirection>('to_client');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [externalBillNo, setExternalBillNo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ['billPackages', projectId],
    queryFn: () => listBillPackages(projectId),
  });

  const compose = useMutation({
    mutationFn: () =>
      composeBillPackage(projectId, {
        direction,
        periodFrom,
        periodTo,
        ...(direction === 'to_subcontractor' && workOrderId
          ? { workOrderId }
          : {}),
        ...(externalBillNo ? { externalBillNo } : {}),
      }),
    onSuccess: (pkg) => {
      setError(null);
      void queryClient.invalidateQueries({
        queryKey: ['billPackages', projectId],
      });
      window.location.assign(ROUTES.projectsBillPackage(projectId, pkg.id));
    },
    onError: (err: unknown) => setError(describe(err)),
  });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">
          Running-account bills
        </h2>
        <p className="text-sm text-gray-600">
          A period&rsquo;s claim as a complete package: the check list, the
          abstract, the priced schedule, a measurement sheet for every item and
          the debit register. Quantities are proposed from approved daily work —
          you review them rather than entering them.
        </p>
      </header>

      <form
        className="grid gap-4 rounded-md border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          compose.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Direction</span>
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as BillDirection)
            }
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            {BILL_DIRECTIONS.map((option) => (
              <option key={option} value={option}>
                {DIRECTION_LABEL[option]}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            The two measure <strong>different schedules</strong> — the
            project&rsquo;s own BOQ, or that subcontractor&rsquo;s award lines.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Period from</span>
          <input
            type="date"
            required
            value={periodFrom}
            onChange={(event) => setPeriodFrom(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Period to</span>
          <input
            type="date"
            required
            value={periodTo}
            onChange={(event) => setPeriodTo(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <span className="text-xs text-gray-500">
            Both dates included. A cycle running the 21st to the 20th is not a
            month anybody can derive.
          </span>
        </label>

        {direction === 'to_subcontractor' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Work order</span>
            <input
              value={workOrderId}
              onChange={(event) => setWorkOrderId(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
              placeholder="Work order id"
            />
            <span className="text-xs text-gray-500">
              Required: a bill to a subcontractor measures that
              subcontractor&rsquo;s award lines.
            </span>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              Their bill reference
            </span>
            <input
              value={externalBillNo}
              onChange={(event) => setExternalBillNo(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
              placeholder="0016014256/12"
            />
            <span className="text-xs text-gray-500">
              Recorded, never generated — it belongs to their system.
            </span>
          </label>
        )}

        <div className="flex items-end">
          <Button type="submit" disabled={compose.isPending}>
            {compose.isPending ? 'Composing…' : 'Compose'}
          </Button>
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading bills…
        </p>
      ) : (packages ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          No bill has been composed on this project yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2 text-right">Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(packages ?? []).map((pkg) => (
                <tr key={pkg.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={ROUTES.projectsBillPackage(projectId, pkg.id)}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {pkg.label}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {DIRECTION_LABEL[pkg.direction]}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {dateLabel(pkg.periodFrom)} – {dateLabel(pkg.periodTo)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={pkg.status} />
                  </td>
                  <td className="px-3 py-2">
                    {pkg.issuedAt ? dateLabel(pkg.issuedAt) : '—'}
                  </td>
                  {/* Shown exactly as the server rendered it (024 FR-009). No formatting here: the
                      API rounds once, to the rupee, and a second pass in the browser is how two
                      screens come to disagree by a rupee on a document a client signs. */}
                  <td className="px-3 py-2 text-right font-medium">
                    {pkg.payable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function describe(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string; code?: string };
  };
  if (anyErr?.status === 423) {
    return 'This project is locked, so a bill cannot be composed against it. This is not a permission problem.';
  }
  // Every refusal 023 can give names its own condition and says what to do — a period that
  // overlaps one already billed, a project with no BOQ, a missing retention term. Passing the
  // server's own sentence through is the whole value of having written them.
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'The bill could not be composed and the server gave no reason.'
  );
}
