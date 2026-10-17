'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  BILL_DIRECTIONS,
  BILL_PACKAGES_PAGE_SIZE,
  type BillDirection,
  type BillPackageListItem,
  composeBillPackage,
  listBillPackagesPage,
} from '@/app/lib/api/bill-packages';
import { getWorkOrders } from '@/app/lib/api/billing';
import {
  BILL_PACKAGE_LIST_COPY,
  BILL_PACKAGE_PICKER_COPY,
  ROUTES,
  projectsLabel,
} from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Pager from '@/app/ui/inventory/pager';
import {
  projectErrorMessage,
  useProjectLock,
} from '@/app/ui/projects/project-lock-context';
import { useVendorOptions } from '@/app/ui/projects/ra-bills-panel';
import QueryError from '@/app/ui/query-error';
import SearchableSelect from '@/app/ui/searchable-select';
import { ListSkeleton } from '@/app/ui/skeletons';
import {
  UNASSIGNED_SUBCONTRACTOR,
  visibleWorkOrders,
  workOrderBelongsToSubcontractor,
} from '@/app/ui/projects/work-order-picker';
import { FieldLabelSpacer } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import {
  SortHeader,
  TABLE,
  useSortedRows,
  type SortableColumn,
} from '@/app/ui/table';

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
  // Prefilled from the link a work order's "Generate the next bill" sends here, so the person lands
  // on the form for that subcontractor and that award rather than choosing them again.
  const params = useSearchParams();
  const [direction, setDirection] = useState<BillDirection>(() =>
    params.get('direction') === 'to_subcontractor'
      ? 'to_subcontractor'
      : 'to_client',
  );
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [workOrderId, setWorkOrderId] = useState(
    () => params.get('workOrderId') ?? '',
  );
  const [partnerId, setPartnerId] = useState(
    () => params.get('partnerId') ?? '',
  );
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
  /*
   * Fetched whatever the direction, since 2026-10-13: the list of bills already raised names the
   * subcontractor each one is to, and that name is reached through the work order. Gated on the
   * form's direction, the column was blank until somebody touched a control they had no reason to
   * touch. The key is the Subcontractors tab's own, so on that tab's data this costs no request.
   */
  const workOrders = useQuery({
    queryKey: ['workOrders', projectId],
    queryFn: () => getWorkOrders(projectId),
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

  /**
   * Whose contract a subcontractor bill was raised against (2026-10-13).
   *
   * `counterpartyKey` is the **work order's** id, because that is what the running number is scoped
   * to — so two subcontractors on one project both hold an `RA-01`, and the register could not say
   * which was whose. The work order carries `partnerId` and the vendor names come from the hook
   * this composer already uses, so the name is resolved from two lists already on the screen.
   *
   * Resolved here rather than served by the API: `WorkOrder.partnerId` is a bare column with no
   * relation, deliberately — the vendor register belongs to another module's schema — so the server
   * would have to cross a boundary it is built not to cross for a label.
   *
   * Three ways this comes back without a name, and each is said rather than left blank. A work
   * order with no subcontractor set is the reported case and is still billable; a work order or a
   * vendor the lists have not produced yet is a row rendered mid-load, where the key is the honest
   * answer and an empty cell reads as a bill belonging to nobody.
   */
  const subcontractorOf = (counterpartyKey: string): string => {
    const order = orders.find((candidate) => candidate.id === counterpartyKey);
    if (!order) return workOrders.isLoading ? '…' : counterpartyKey;
    if (order.partnerId === null) {
      return BILL_PACKAGE_LIST_COPY.subcontractorUnknown;
    }
    return vendors.byId.get(order.partnerId) ?? counterpartyKey;
  };

  /**
   * 036 I17 + I26 (2026-10-18): one page at a time, with its total, rather than every package on the
   * project in one (capped) response — and a failed read says so with a Retry instead of falling
   * through to "No bills yet", which told a person on a dropped connection that nothing had ever
   * been billed. The key stays under `['billPackages', projectId]`, so every existing invalidation
   * of that prefix (this composer, the DWR panel) still refreshes it. `keepPreviousData` holds the
   * current page on screen while the next one loads, so Next does not blank the tables.
   *
   * Both direction tables read the same page: the API pages the project's packages as one list,
   * and the pager under them counts that list.
   */
  const [page, setPage] = useState(1);
  const packagesQuery = useQuery({
    queryKey: ['billPackages', projectId, 'page', page],
    queryFn: () => listBillPackagesPage(projectId, page),
    placeholderData: keepPreviousData,
  });
  const packages = packagesQuery.data?.items;
  const { isLocked } = useProjectLock();

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

      {/* Absent on a locked project (036 Wave 3, 2026-10-18): composing is a write the server
          refuses with a 423, so a form here would only collect a period to be turned away. */}
      {isLocked ? (
        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          This project is locked, so no bill can be composed on it. The bills
          already raised are below.
        </p>
      ) : (
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
                {projectsLabel(option)}
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
            // 036 I18 (2026-10-18): the picker itself refuses a period that ends before it starts,
            // rather than the server answering a submit with a 400.
            max={periodTo || undefined}
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
            min={periodFrom || undefined}
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
              {/* 036 I18 (2026-10-18): typed into rather than scrolled. The list is the
                  subcontractors holding a work order on this project — narrowed from the
                  project's own orders, so it is held in memory and searched there; a server
                  search over the whole vendor register would offer people who cannot be billed
                  here. A vendor whose record this user cannot read still has work orders, so its
                  entry stands with the register's own fallback rather than vanishing; and the
                  unassigned orders keep their own entry (FR-027), never a filter. */}
              <SearchableSelect
                value={partnerId}
                onChange={chooseSubcontractor}
                emptyLabel={BILL_PACKAGE_PICKER_COPY.subcontractorAll}
                placeholder="Type a subcontractor’s name"
                options={[
                  ...subcontractors.map(([id, name]) => ({
                    id,
                    label:
                      name ?? BILL_PACKAGE_PICKER_COPY.subcontractorUnassigned,
                  })),
                  ...(hasUnassigned
                    ? [
                        {
                          id: UNASSIGNED_SUBCONTRACTOR,
                          label: BILL_PACKAGE_PICKER_COPY.subcontractorUnassigned,
                        },
                      ]
                    : []),
                ]}
              />
              {workOrders.isError && (
                <QueryError
                  compact
                  error={workOrders.error}
                  fallback="The work orders could not be loaded."
                  onRetry={workOrders.refetch}
                />
              )}
              <span className="text-xs text-gray-500">
                {partnerId === UNASSIGNED_SUBCONTRACTOR
                  ? BILL_PACKAGE_PICKER_COPY.unassignedHint
                  : BILL_PACKAGE_PICKER_COPY.subcontractorHint}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Work order</span>
              {/* 036 I18: searchable by number, detail or award state. An order with no award
                  captured cannot be billed — the server refuses it by name — so it is listed with
                  that said rather than hidden (a work order missing from this list reads as one
                  that does not exist), and choosing it explains instead of selecting. The number
                  leads where there is one, because it is what the order is called everywhere
                  else; orders raised before 027 numbered them read by their detail alone. */}
              <SearchableSelect
                value={workOrderId}
                onChange={(next) => {
                  const order = visibleOrders.find((o) => o.id === next);
                  if (order && order.awardLineCount === 0) {
                    setError(
                      `${order.code ?? order.workDetail} has no award captured yet, so it cannot be billed. Capture its award on Subcontractors first.`,
                    );
                    return;
                  }
                  setError(null);
                  setWorkOrderId(next);
                  setClearedFor(null);
                }}
                emptyLabel={
                  workOrders.isLoading
                    ? 'Loading work orders…'
                    : visibleOrders.length === 0 && partnerId !== ''
                      ? BILL_PACKAGE_PICKER_COPY.noWorkOrders
                      : 'Choose a work order'
                }
                placeholder="Type a number or the work"
                options={visibleOrders.map((order) => ({
                  id: order.id,
                  label: order.code ?? order.workDetail,
                  sublabel: order.code ? order.workDetail : undefined,
                  note: `retention ${(Number(order.retentionPercent) * 100).toFixed(2)}%${
                    order.awardLineCount === 0
                      ? ' · no award captured yet'
                      : ` · ${order.awardLineCount} award line${order.awardLineCount === 1 ? '' : 's'}`
                  }`,
                }))}
              />
              <span className="text-xs text-gray-500">
                A bill to a subcontractor measures that subcontractor&rsquo;s
                award lines. Capture the award on{' '}
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
          <Button type="submit" loading={compose.isPending}>
            {compose.isPending ? 'Composing…' : 'Compose'}
          </Button>
        </div>
      </form>
      )}

      {error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {packagesQuery.isLoading ? (
        <div role="status" aria-label="Loading bills…">
          <ListSkeleton
            headers={['Bill', 'Period', 'State', 'Issued', 'Payable']}
            rows={4}
          />
        </div>
      ) : packagesQuery.isError ? (
        // 036 I17: a failed read is not "No bills yet" — the empty states below only render once
        // the list has actually arrived.
        <QueryError
          error={packagesQuery.error}
          fallback="The bills could not be loaded."
          onRetry={packagesQuery.refetch}
        />
      ) : (
        <>
          <BillTable
            projectId={projectId}
            heading={BILL_PACKAGE_LIST_COPY.toClientHeading}
            hint={BILL_PACKAGE_LIST_COPY.toClientHint}
            empty={BILL_PACKAGE_LIST_COPY.noneToClient}
            rows={(packages ?? []).filter(
              (pkg) => pkg.direction === 'to_client',
            )}
          />
          <BillTable
            projectId={projectId}
            heading={BILL_PACKAGE_LIST_COPY.toSubcontractorHeading}
            hint={BILL_PACKAGE_LIST_COPY.toSubcontractorHint}
            empty={BILL_PACKAGE_LIST_COPY.noneToSubcontractor}
            rows={(packages ?? []).filter(
              (pkg) => pkg.direction === 'to_subcontractor',
            )}
            counterparty={subcontractorOf}
          />
          <Pager
            total={packagesQuery.data?.total ?? 0}
            page={page}
            pageSize={packagesQuery.data?.pageSize ?? BILL_PACKAGES_PAGE_SIZE}
            onPageChange={setPage}
            noun="bill"
          />
        </>
      )}
    </section>
  );
}

/**
 * One direction's bills.
 *
 * Two tables rather than one with a Direction column (2026-10-13). The two are different series of
 * different documents to different parties, and a reader arrives looking for one of them — `RA-04`
 * to the client sitting two rows from `RA-04` to a subcontractor was a register nobody could scan.
 * A heading says the direction once for every row beneath it, so the column goes.
 *
 * `counterparty` is given only for the subcontractor table, where the number alone cannot identify
 * a bill: the series runs per work order, so each subcontractor holds their own `RA-01`.
 */
function BillTable({
  projectId,
  heading,
  hint,
  empty,
  rows,
  counterparty,
}: {
  projectId: string;
  heading: string;
  hint: string;
  empty: string;
  rows: BillPackageListItem[];
  counterparty?: (counterpartyKey: string) => string;
}) {
  // Sortable by any column (2026-10-15): the period by its first day, the dates as dates, and the
  // payable by its figure, read out of the server's rendered text.
  const columns: (SortableColumn<BillPackageListItem> & {
    label: string;
    numeric?: boolean;
  })[] = [
    { key: 'label', label: 'Bill', render: (pkg) => pkg.label },
    ...(counterparty
      ? [
          {
            key: 'counterparty',
            label: BILL_PACKAGE_LIST_COPY.subcontractorColumn,
            render: (pkg: BillPackageListItem) =>
              pkg.counterpartyName ?? counterparty(pkg.counterpartyKey),
          },
        ]
      : []),
    { key: 'periodFrom', label: 'Period', render: (pkg) => pkg.periodFrom },
    { key: 'status', label: 'State', render: (pkg) => pkg.status },
    { key: 'issuedAt', label: 'Issued', render: (pkg) => pkg.issuedAt },
    {
      key: 'payable',
      label: 'Payable',
      numeric: true,
      render: (pkg) => pkg.payable,
    },
  ];
  const { sorted, sort, toggle } = useSortedRows(rows, columns);

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
        <p className="text-sm text-gray-600">{hint}</p>
      </div>
      {/*
        Said, not omitted. A direction with no bills is a fact about the project — nobody has
        claimed from the client yet — and a section that simply vanished would read as a screen
        that had not finished loading.
      */}
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          {empty}
        </p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                {columns.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    columnKey={column.key}
                    sort={sort}
                    onSort={toggle}
                    numeric={column.numeric}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pkg) => (
                <tr key={pkg.id} className={TABLE.row}>
                  <td className={TABLE.td}>
                    <Link
                      href={ROUTES.projectsBillPackage(projectId, pkg.id)}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {pkg.label}
                    </Link>
                    {/* The approver opening the project sees which bill is waiting on them. */}
                    {pkg.awaitingMe && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Awaiting your approval
                      </span>
                    )}
                  </td>
                  {counterparty && (
                    <td className={TABLE.td}>
                      {pkg.counterpartyName ??
                        counterparty(pkg.counterpartyKey)}
                    </td>
                  )}
                  <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
                    {dateLabel(pkg.periodFrom)} – {dateLabel(pkg.periodTo)}
                  </td>
                  <td className={TABLE.td}>
                    <StatusBadge status={pkg.status} />
                  </td>
                  <td className={TABLE.td}>
                    {pkg.issuedAt ? dateLabel(pkg.issuedAt) : '—'}
                  </td>
                  {/* Shown exactly as the server rendered it (024 FR-009). No formatting here: the
                      API rounds once, to the rupee, and a second pass in the browser is how two
                      screens come to disagree by a rupee on a document a client signs. */}
                  <td className={clsx(TABLE.td, TABLE.numeric, 'font-medium')}>
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
  // 036 Wave 3: the one lock sentence every project screen uses.
  if (anyErr?.status === 423) return projectErrorMessage(err);
  // Every refusal 023 can give names its own condition and says what to do — a period that
  // overlaps one already billed, a project with no BOQ, a missing retention term. Passing the
  // server's own sentence through is the whole value of having written them.
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'The bill could not be composed and the server gave no reason.'
  );
}
