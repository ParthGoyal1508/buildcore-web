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
import { getWorkOrders } from '@/app/lib/api/billing';
import { BILL_PACKAGE_PICKER_COPY, ROUTES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { useVendorOptions } from '@/app/ui/projects/ra-bills-panel';
import {
  UNASSIGNED_SUBCONTRACTOR,
  visibleWorkOrders,
  workOrderBelongsToSubcontractor,
} from '@/app/ui/projects/work-order-picker';
import { FieldLabelSpacer } from '@/app/ui/settings/form-fields';
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
 *
 * ## The subcontractor is chosen before the work order (028 FR-025 to FR-027)
 *
 * A project can carry dozens of work orders and this offered them as one flat list, so finding the
 * right one meant reading every entry. Choosing the subcontractor first narrows it to their
 * contracts — which is how anybody actually thinks about it, and needs **no endpoint**: `WorkOrder`
 * already carries `partnerId` and the vendor names come from the hook the Subcontractors tab uses.
 *
 * Two details that are the whole point rather than polish:
 *
 * - **The chosen work order clears when the subcontractor changes** (FR-026). A selection left
 *   standing composes a bill against the wrong contract — the one failure this control can
 *   introduce, and it would produce a plausible-looking bill measured against somebody else's
 *   award.
 * - **Work orders with no `partnerId` get their own entry** (FR-027), not a filter. `partnerId` is
 *   nullable, so filtered out they are unbillable with nothing on screen to say why — and the fix
 *   for one is to set its subcontractor, which nobody can know to do if they cannot see it.
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
  const [partnerId, setPartnerId] = useState('');
  const [clearedFor, setClearedFor] = useState<string | null>(null);
  const [externalBillNo, setExternalBillNo] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * The project's work orders, so a bill to a subcontractor is chosen rather than typed.
   *
   * This was a text box asking for a "Work order id" — a cuid, which is shown nowhere in the
   * product and which nobody could have supplied. A work order carries no number of its own
   * either, so what identifies one to a person is what it is for: the work detail, with its
   * retention and how much award has been captured against it.
   */
  const workOrders = useQuery({
    queryKey: ['workOrders', projectId],
    queryFn: () => getWorkOrders(projectId),
    enabled: direction === 'to_subcontractor',
  });

  // The same hook, the same key and therefore the same fetch the Subcontractors tab makes
  // (FR-025). A second key would hit the network for the same list and be free to produce a
  // different one the day somebody changed the filter there.
  const vendors = useVendorOptions();

  const orders = workOrders.data ?? [];

  /**
   * The subcontractors who actually hold a work order on **this** project.
   *
   * Narrowed from the project's own orders rather than offering the whole vendor register: a
   * picker listing two hundred vendors of whom three can be billed here is a longer list than the
   * one it replaced.
   */
  const subcontractors = [
    ...new Map(
      orders
        .filter((order) => order.partnerId !== null)
        .map((order) => [
          order.partnerId as string,
          vendors.byId.get(order.partnerId as string) ?? null,
        ]),
    ),
  ];
  const hasUnassigned = orders.some((order) => order.partnerId === null);

  const visibleOrders = visibleWorkOrders(orders, partnerId);

  /**
   * FR-026, and the one failure this control can introduce.
   *
   * Clearing in the change handler rather than in an effect keyed on `partnerId`: an effect runs
   * *after* the render that already offered the stale selection, which leaves one frame in which
   * a submit composes against the previous subcontractor's contract. Here there is no such frame.
   */
  const chooseSubcontractor = (next: string) => {
    setPartnerId(next);
    setClearedFor(workOrderId ? next : null);
    setWorkOrderId('');
    setError(null);
  };

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
        className="grid items-start gap-4 rounded-md border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          // FR-026's belt and braces. The change handler clears the selection, which is the fix;
          // this refuses the submit if a stale one ever reaches it anyway, because the cost of
          // being wrong here is a bill measured against another subcontractor's award.
          if (
            direction === 'to_subcontractor' &&
            !workOrderBelongsToSubcontractor(orders, partnerId, workOrderId)
          ) {
            setWorkOrderId('');
            setError(BILL_PACKAGE_PICKER_COPY.selectionCleared);
            return;
          }
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
          <>
            {/* FR-025. Ahead of Work order, because it is what narrows it. */}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">
                {BILL_PACKAGE_PICKER_COPY.subcontractorLabel}
              </span>
              <select
                value={partnerId}
                onChange={(event) => chooseSubcontractor(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">
                  {BILL_PACKAGE_PICKER_COPY.subcontractorAll}
                </option>
                {subcontractors.map(([id, name]) => (
                  <option key={id} value={id}>
                    {/* A vendor whose record this user cannot read still has work orders, so the
                        entry stands with the register's own fallback rather than vanishing. */}
                    {name ?? BILL_PACKAGE_PICKER_COPY.subcontractorUnassigned}
                  </option>
                ))}
                {hasUnassigned && (
                  // FR-027. Its own entry, never a filter: these work orders are billable, and a
                  // reader who cannot see them cannot know to set a subcontractor on one.
                  <option value={UNASSIGNED_SUBCONTRACTOR}>
                    {BILL_PACKAGE_PICKER_COPY.subcontractorUnassigned}
                  </option>
                )}
              </select>
              <span className="text-xs text-gray-500">
                {partnerId === UNASSIGNED_SUBCONTRACTOR
                  ? BILL_PACKAGE_PICKER_COPY.unassignedHint
                  : BILL_PACKAGE_PICKER_COPY.subcontractorHint}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Work order</span>
              <select
                value={workOrderId}
                onChange={(event) => {
                  setWorkOrderId(event.target.value);
                  setClearedFor(null);
                }}
                className="rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">
                  {workOrders.isLoading
                    ? 'Loading work orders…'
                    : visibleOrders.length === 0 && partnerId !== ''
                      ? BILL_PACKAGE_PICKER_COPY.noWorkOrders
                      : 'Choose a work order'}
                </option>
                {visibleOrders.map((order) => (
                  // An award is what a subcontractor bill measures, so one with none captured
                  // cannot be billed — the server refuses it by name. Offered as a disabled row
                  // rather than hidden: a work order missing from this list reads as a work order
                  // that does not exist, and the thing to do about it is capture its award.
                  <option
                    key={order.id}
                    value={order.id}
                    disabled={order.awardLineCount === 0}
                  >
                    {/* The number leads, because it is what the work order is called everywhere
                        else — on the order itself, and in what the subcontractor quotes back.
                        Null on the work orders raised before 027 numbered them, which read by
                        their detail alone rather than by an empty prefix. */}
                    {order.code ? `${order.code} — ` : ''}
                    {order.workDetail}
                    {` — retention ${(Number(order.retentionPercent) * 100).toFixed(2)}%`}
                    {order.awardLineCount === 0
                      ? ' · no award captured yet'
                      : ` · ${order.awardLineCount} award line${order.awardLineCount === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                A bill to a subcontractor measures that subcontractor&rsquo;s award
                lines. Capture the award on{' '}
                <strong>Subcontractors</strong> before billing against it.
              </span>
              {clearedFor !== null && (
                // Said, not silent. A control that empties itself without explanation reads as the
                // form losing the entry — and the reader's instinct is to re-pick the one that was
                // just cleared for being the wrong subcontractor's.
                <span
                  role="status"
                  className="text-xs font-medium text-amber-800"
                >
                  {BILL_PACKAGE_PICKER_COPY.selectionCleared}
                </span>
              )}
            </label>
          </>
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

        {/* Grid cells stretch to the tallest in the row — here the Direction field, whose hint
            runs to three lines — so `items-end` dropped this button to the bottom of that cell,
            well below the inputs it sits beside. `items-start` on the grid holds every control on
            one line, and the spacer stands in for the label this button does not have. */}
        <div>
          <FieldLabelSpacer />
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
