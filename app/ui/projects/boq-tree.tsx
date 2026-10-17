'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import * as React from 'react';
import { useMemo, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteBOQItem,
  getBOQ,
  planBOQItem,
  type BoqGroup,
  type BoqItem,
  boqKeys,
} from '@/app/lib/api/projects';
import { percentLabel, scheduleTotals } from '@/app/lib/bill-totals';
import { BOQ_COPY } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { rupees, dateLabel, quantity3 } from '@/app/lib/format';
import { useDebounced } from '@/app/lib/use-url-state';
import {
  isProjectLockedError,
  projectErrorMessage,
  useProjectLock,
} from '@/app/ui/projects/project-lock-context';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';
import QueryError from '@/app/ui/query-error';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { TABLE } from '@/app/ui/table';
import { confirmDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';

/**
 * The shared table look at the BOQ's density (2026-10-15): eleven columns over a tender of a few
 * hundred lines, where px-4 py-3 pushes the programme columns off the screen. `!` because clsx
 * does not drop TABLE's own padding.
 */
const DENSE_TH = clsx(TABLE.th, '!px-3 !py-2');
const DENSE_TD = clsx(TABLE.td, '!px-3 !py-2');

/**
 * 036 I12 (2026-10-17): the header row and the BOQ No. column stay put while a 1,000-line, 60rem-wide
 * schedule scrolls under them. The wrap gets a height so the header has something to stick within —
 * `sticky top-0` inside an `overflow-x-auto` box sticks to that box, not to the page — and each
 * sticky cell is opaque so the rows do not show through it.
 */
const STICKY_TH = 'sticky top-0 z-20 bg-gray-50';
const STICKY_CORNER = 'sticky left-0 top-0 z-30 bg-gray-50';

/** A delete refusal in words that match the cause (036 I12, 2026-10-17). */
function deleteErrorMessage(err: unknown): string {
  // Only the "work recorded" refusal says work has been recorded. It is the API's 409 from
  // `BoqService.deleteItem`, whose own sentence also names what was recorded (so many DWR entries,
  // so many bill lines); the copy is the fallback for a 409 that arrives without one. Every other
  // failure — the lock, a line already gone, a dropped connection — used to say "work has been
  // recorded" too, which sent people looking for work that did not exist.
  if (err instanceof ApiError && err.status === 409) {
    return err.message || BOQ_COPY.deleteBlocked;
  }
  if (isProjectLockedError(err)) return projectErrorMessage(err);
  return projectErrorMessage(err, 'The line could not be deleted. Please try again.');
}

/** True when the line, or its section, matches the search (036 I12): BOQ No. or description. */
function matches(term: string, ...fields: (string | null | undefined)[]) {
  return fields.some((field) => field?.toLowerCase().includes(term));
}

/** One CSV cell: quoted when it has to be, with embedded quotes doubled (RFC 4180). */
function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The project's BOQ as the two-level schedule its source actually is (008 FR-025, FR-026).
 *
 * **A section heading is rendered as a heading, not as a line with no quantity.** Showing it in
 * the quantity column is wrong both ways: blank reads as missing data and `0` reads as a real
 * figure, and the row is in fact a title. It spans instead.
 *
 * **Unplanned reads as the word, never as an em dash or a zero.** An imported tender is entirely
 * unplanned on the day it arrives — all 231 lines of the client's own file — so this is the
 * screen's normal state rather than an exception in it. A zero per-day target would claim the work
 * is achieving nothing, which is a different fact from nobody having set a target.
 *
 * The table scrolls inside its own container (FR-032). It is eleven columns wide, so the page body
 * must not be what moves sideways.
 *
 * ## One schedule at a time (027)
 *
 * A project can carry two: the tender workbook the client is billed against, and an internal
 * estimate of what the work costs us. Both import through this screen, and until 2026-10-06 both
 * landed in this one list — a reader saw "Section 2 Centering & shuttering" twice, at (3) lines and
 * at (9), with nothing saying which was which.
 *
 * The estimate is not a second opinion about the same columns. It carries no programme, is excluded
 * from the alerts, and is never measured against: `Done`, `Pending`, `Per day`, `Avg / day` and
 * `Finish by` are five columns that can only ever read 0.000 and *Not planned* on it. It shows a
 * costing instead — quantity, rate, amount and a total — which is the question an estimate is
 * imported to answer.
 */
export default function BoqTree({
  projectId,
  variant = 'contract',
}: {
  projectId: string;
  /** Which of the project's two schedules to show. See the class note above. */
  variant?: 'contract' | 'estimate';
}) {
  const isEstimate = variant === 'estimate';
  const queryClient = useQueryClient();
  const { isLocked } = useProjectLock();
  const { project } = useProjectShell();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim().toLowerCase());
  const toast = useToast();

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: boqKeys.project(projectId),
    queryFn: () => getBOQ(projectId),
  });

  // One read serves both tabs: the query key is the same, so switching tabs costs no request.
  const groups = useMemo(
    () => (data ?? []).filter((group) => group.isEstimate === isEstimate),
    [data, isEstimate],
  );

  /**
   * 036 I12 (2026-10-17): the search. Client-side, because the whole schedule is already here — the
   * tree has always fetched every line. A section whose own number or name matches keeps all its
   * lines; otherwise it keeps the lines that match, under its heading, so a hit is never shown
   * without the section it belongs to. Sections with nothing matching drop out.
   */
  const visible = useMemo(() => {
    if (!term) return groups;
    return groups.flatMap((group) => {
      if (matches(term, group.boqNo, group.name)) return [group];
      const items = group.items.filter((item) =>
        matches(term, item.boqNo, item.taskName),
      );
      return items.length > 0 ? [{ ...group, items }] : [];
    });
  }, [groups, term]);

  /**
   * Giving a line its programme (025 FR-009), in place on the row it belongs to.
   *
   * **This is the only way an imported line can ever be planned.** A tender schedule carries no
   * dates and the importer reads none, so every line arrives unplanned; until the API grew a PATCH
   * there was no update of any kind for a BOQ item, and the only route to a finish date was to
   * delete the line and add it again — impossible once a day's work has been measured against it.
   */
  const plan = useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: string;
      input: Parameters<typeof planBOQItem>[2];
    }) => planBOQItem(projectId, itemId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: boqKeys.project(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'boq-alerts'],
      });
      setPlanning(null);
      setError(null);
    },
    // The server names every refusal it gives — a finish date before the start date says which two
    // dates contradict each other — so its sentence is worth more than anything written here. A 423
    // gets the lock sentence (036 I12).
    onError: (err: Error) => setError(projectErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => deleteBOQItem(projectId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: boqKeys.project(projectId),
      });
      // The alert tabs read the same lines through a different endpoint, so they go stale with it.
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'boq-alerts'],
      });
      setError(null);
      toast.success('The line was deleted.');
    },
    onError: (err: Error) => setError(deleteErrorMessage(err)),
  });

  const toggle = (groupId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  if (isLoading)
    return (
      <div role="status" aria-label={BOQ_COPY.loading}>
        <ListSkeleton
          headers={[
            BOQ_COPY.columnBoqNo,
            BOQ_COPY.columnTask,
            BOQ_COPY.columnUnit,
            BOQ_COPY.columnScope,
            BOQ_COPY.rate,
          ]}
          rows={8}
        />
      </div>
    );
  if (isError)
    return (
      <QueryError
        error={loadError}
        fallback={BOQ_COPY.loadFailed}
        onRetry={refetch}
      />
    );

  if (groups.length === 0) {
    return (
      <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
        {isEstimate ? BOQ_COPY.estimateEmpty : BOQ_COPY.contractEmpty}
      </p>
    );
  }

  // What the work is estimated to cost, across the whole schedule. The reason an estimate is
  // imported at all, and it was nowhere on this screen.
  const estimatedTotal = groups.reduce(
    (total, group) =>
      total +
      group.items.reduce((sum, item) => sum + item.scopeQty * item.rate, 0),
    0,
  );

  // The contract schedule's two figures: what it prices at, and what it is worth once the quote is
  // on it. `scheduleTotals` rather than a sum of discounted lines — it applies the percentage
  // **once, to the total**, which is how the tender document computes it; per line it would round
  // to paise on every one of them and drift from the figure the client signed.
  const quotedFraction = Number(project.quotedPercentage ?? 0) || 0;
  const totals = scheduleTotals(
    groups.flatMap((group) =>
      group.items.map((item) => ({ scopeQty: item.scopeQty, rate: item.rate })),
    ),
    quotedFraction,
  );

  /**
   * 036 I12 (2026-10-17): the rows matching the search, as a CSV built here — no new dependency, and
   * no server round trip for figures already on screen. Folded sections are included: folding is a
   * reading aid, and an export that silently dropped a section because it was closed would be short.
   */
  const exportCsv = () => {
    const header = isEstimate
      ? ['Section', 'BOQ No.', 'Item', 'Unit', 'Scope qty', 'Rate', 'Amount']
      : [
          'Section',
          'BOQ No.',
          'Item',
          'Unit',
          'Scope qty',
          'Rate',
          'Done',
          'Pending',
          'Per day',
          'Avg / day',
          'Finish by',
        ];
    const lines = [header.map(csvCell).join(',')];
    for (const group of visible) {
      for (const item of group.items) {
        // Plain numbers, not the grouped display strings: "1,420.855" is two cells to a spreadsheet.
        const base = [
          `${group.boqNo} ${group.name}`,
          item.boqNo,
          item.taskName,
          item.unit,
          item.scopeQty,
          item.rate,
        ];
        const rest = isEstimate
          ? [Math.round(item.scopeQty * item.rate * 100) / 100]
          : [
              item.doneQty,
              item.pendingQty,
              item.perDayQty,
              item.avgQtyPerDay,
              item.finishDate ? dateLabel(item.finishDate) : '',
            ];
        lines.push([...base, ...rest].map(csvCell).join(','));
      }
    }
    // A BOM so Excel reads the file as UTF-8 — task names carry "²", "³" and "₹".
    saveBlob(
      new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      `boq-${isEstimate ? 'estimate' : 'contract'}${term ? '-filtered' : ''}.csv`,
    );
  };

  const visibleLines = visible.reduce((n, group) => n + group.items.length, 0);

  return (
    <div className="space-y-2">
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {/*
        The quote, on the screen the quote applies to.
        Contract only: the estimate is our own costing of the same work, and the percentage is what
        the client is billed at — putting it on a costing would answer a question nobody asked of
        it. Shown even at par, because "at par" is a fact about the contract and a blank space is
        not: the absence of this band was the whole defect.
      */}
      {!isEstimate && (
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-gray-500">{BOQ_COPY.scheduleTotalLabel}</dt>
            <dd className="font-medium tabular-nums text-gray-900">
              {rupees(totals.estimatedTotal)}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-gray-500">{BOQ_COPY.quotedLabel}</dt>
            <dd className="font-medium tabular-nums text-gray-900">
              {quotedFraction === 0
                ? BOQ_COPY.quotedAtPar
                : percentLabel(quotedFraction)}
            </dd>
          </div>
          {quotedFraction !== 0 && (
            <div className="flex items-baseline gap-2">
              <dt className="text-gray-500">{BOQ_COPY.contractTotalLabel}</dt>
              <dd className="font-semibold tabular-nums text-gray-900">
                {rupees(totals.quotedTotal)}
              </dd>
            </div>
          )}
          <p className="w-full text-xs text-gray-500">{BOQ_COPY.quotedNote}</p>
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search the BOQ</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by BOQ No. or item"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {term && (
          <span className="text-xs text-gray-500" role="status">
            {visibleLines === 0
              ? 'No lines match.'
              : `${visibleLines} ${visibleLines === 1 ? 'line' : 'lines'} match`}
          </span>
        )}
        <SecondaryButton
          type="button"
          onClick={exportCsv}
          disabled={visibleLines === 0}
          className="ml-auto"
        >
          Export CSV
        </SecondaryButton>
      </div>

      <div className={clsx(TABLE.wrap, 'max-h-[75vh] overflow-y-auto')}>
        <table className={clsx(TABLE.table, 'w-full min-w-[60rem]')}>
          <caption className="sr-only">{BOQ_COPY.heading}</caption>
          <thead className={TABLE.thead}>
            <tr>
              <th scope="col" className={clsx(DENSE_TH, STICKY_CORNER)}>
                {BOQ_COPY.columnBoqNo}
              </th>
              <th scope="col" className={clsx(DENSE_TH, STICKY_TH)}>
                {BOQ_COPY.columnTask}
              </th>
              <th scope="col" className={clsx(DENSE_TH, STICKY_TH)}>
                {BOQ_COPY.columnUnit}
              </th>
              <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                {BOQ_COPY.columnScope}
              </th>
              <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                {BOQ_COPY.rate}
              </th>
              {isEstimate ? (
                <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                  {BOQ_COPY.columnAmount}
                </th>
              ) : (
                <>
                  <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                    {BOQ_COPY.columnDone}
                  </th>
                  <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                    {BOQ_COPY.columnPending}
                  </th>
                  <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                    {BOQ_COPY.columnPerDay}
                  </th>
                  <th scope="col" className={clsx(DENSE_TH, STICKY_TH, 'text-right')}>
                    {BOQ_COPY.columnAvgPerDay}
                  </th>
                  <th scope="col" className={clsx(DENSE_TH, STICKY_TH)}>
                    {BOQ_COPY.columnFinish}
                  </th>
                </>
              )}
              {!isLocked && <th scope="col" className={clsx(DENSE_TH, STICKY_TH)} />}
            </tr>
          </thead>
          <tbody>
            {visible.map((group) => (
              <GroupRows
                key={group.id}
                group={group}
                isEstimate={isEstimate}
                // A search opens every section it matched in: a hit hidden in a folded section is
                // a search that found nothing, as far as the reader can see.
                collapsed={!term && collapsed.has(group.id)}
                onToggle={() => toggle(group.id)}
                onDelete={isLocked ? null : (itemId) => remove.mutate(itemId)}
                planningId={planning}
                onPlanOpen={isLocked ? null : setPlanning}
                onPlanSave={(itemId, input) => plan.mutate({ itemId, input })}
                planSaving={plan.isPending}
              />
            ))}
          </tbody>
          {isEstimate && !term && (
            <tfoot className={TABLE.tfoot}>
              <tr>
                <th
                  scope="row"
                  colSpan={5}
                  className={clsx(DENSE_TD, 'text-right text-gray-900')}
                >
                  {BOQ_COPY.estimateTotal}
                </th>
                <td className={clsx(DENSE_TD, TABLE.numeric, 'text-gray-900')}>
                  {rupees(estimatedTotal)}
                </td>
                {!isLocked && <td className={DENSE_TD} />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  isEstimate,
  collapsed,
  onToggle,
  onDelete,
  planningId,
  onPlanOpen,
  onPlanSave,
  planSaving,
}: {
  group: BoqGroup;
  /** A costing section rather than a contract one — six columns, and no programme to plan. */
  isEstimate: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** Null when the project is locked: the control is absent, not disabled. */
  onDelete: ((itemId: string) => void) | null;
  planningId: string | null;
  onPlanOpen: ((itemId: string | null) => void) | null;
  onPlanSave: (
    itemId: string,
    input: Parameters<typeof planBOQItem>[2],
  ) => void;
  planSaving: boolean;
}) {
  const columns = (isEstimate ? 6 : 10) + (onDelete ? 1 : 0);
  // Named on the heading so a folded section still says what it contributes. The whole reason to
  // fold one: a 75-section estimate is unreadable open, and closing it must not hide the money.
  const sectionAmount = group.items.reduce(
    (sum, item) => sum + item.scopeQty * item.rate,
    0,
  );

  return (
    <>
      {/* FR-025. A section spans rather than sitting in the quantity column, because it is a
          title: blank there reads as missing data and 0 reads as a real figure. */}
      <tr className="border-t border-gray-200 bg-gray-50">
        <th scope="rowgroup" colSpan={columns} className="px-3 py-2 text-left">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="sticky left-3 flex items-center gap-2 font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <span aria-hidden="true" className="text-gray-400">
              {collapsed ? '▸' : '▾'}
            </span>
            <span className="text-xs font-normal uppercase tracking-wide text-gray-500">
              {BOQ_COPY.sectionLabel} {group.boqNo}
            </span>
            {group.name}
            <span className="text-xs font-normal text-gray-500">
              ({group.items.length})
            </span>
            {isEstimate && (
              <span className="text-xs font-normal tabular-nums text-gray-500">
                {rupees(sectionAmount)}
              </span>
            )}
          </button>
        </th>
      </tr>

      {!collapsed &&
        group.items.map((item) => (
          <React.Fragment key={item.id}>
            <tr className={TABLE.row}>
              <td
                className={clsx(
                  DENSE_TD,
                  TABLE.stickyCell,
                  'tabular-nums text-gray-500',
                )}
              >
                {item.boqNo}
              </td>
              <td className={clsx(DENSE_TD, 'text-gray-900')}>
                {item.taskName}
                {item.nonBoq ? (
                  <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                    Non-BOQ · added on a bill
                  </span>
                ) : (
                  item.isVariation && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                      {BOQ_COPY.variation}
                    </span>
                  )
                )}
              </td>
              {/* FR-030: exactly as the client spelled it. Tidying `R. mtr` to `R.Mtr.` creates a
                difference they cannot trace against their own sheet. */}
              <td className={clsx(DENSE_TD, 'text-gray-700')}>{item.unit}</td>
              <td className={clsx(DENSE_TD, TABLE.numeric)}>
                {quantity3(item.scopeQty)}
              </td>
              <td className={clsx(DENSE_TD, TABLE.numeric)}>
                {rupees(item.rate)}
              </td>
              {isEstimate ? (
                <td className={clsx(DENSE_TD, TABLE.numeric)}>
                  {rupees(item.scopeQty * item.rate)}
                </td>
              ) : (
                <>
                  <td className={clsx(DENSE_TD, TABLE.numeric)}>
                    {quantity3(item.doneQty)}
                  </td>
                  <td className={clsx(DENSE_TD, TABLE.numeric)}>
                    {quantity3(item.pendingQty)}
                  </td>
                  <Programme value={item.perDayQty} />
                  <Programme value={item.avgQtyPerDay} />
                  <td className={DENSE_TD}>
                    {item.finishDate ? (
                      dateLabel(item.finishDate)
                    ) : (
                      <Unplanned />
                    )}
                  </td>
                </>
              )}
              {onDelete && (
                <td className={DENSE_TD}>
                  <div className="flex justify-end gap-2">
                    {/* No Plan on a costing line: an estimate carries no programme, which is why
                      its five programme columns are absent above. Delete stays, because an
                      estimate imported against the wrong project must be removable. */}
                    {onPlanOpen && !isEstimate && (
                      <RowAction
                        onClick={() =>
                          onPlanOpen(planningId === item.id ? null : item.id)
                        }
                      >
                        {BOQ_COPY.planLine}
                      </RowAction>
                    )}
                    <RowAction
                      onClick={async () => {
                        if (
                          await confirmDialog({
                            title: 'Delete this BOQ item?',
                            message: `${item.boqNo} will be removed from the BOQ. This cannot be undone.`,
                            confirmLabel: 'Delete',
                            tone: 'danger',
                          })
                        )
                          onDelete(item.id);
                      }}
                    >
                      {BOQ_COPY.deleteLine}
                    </RowAction>
                  </div>
                </td>
              )}
            </tr>
            {planningId === item.id && onPlanOpen && (
              <tr className="bg-gray-50">
                <td colSpan={columns} className="px-3 py-3">
                  <PlanRow
                    item={item}
                    saving={planSaving}
                    onCancel={() => onPlanOpen(null)}
                    onSave={(input) => onPlanSave(item.id, input)}
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
    </>
  );
}

/** A programme figure, or the word (FR-026). */
function Programme({ value }: { value: number | null }) {
  return (
    <td className={clsx(DENSE_TD, TABLE.numeric)}>
      {value === null ? <Unplanned /> : quantity3(value)}
    </td>
  );
}

/**
 * **The word, not an em dash and not a zero.**
 *
 * This is the state of every line of a freshly imported tender, so it is the common case on this
 * screen and must read as ordinary rather than as an error. Styled grey for the same reason the
 * location-assignment panel's empty state is grey: colouring the normal case as a warning is how a
 * screen teaches people to ignore its warnings.
 */
function Unplanned() {
  return <span className="text-xs text-gray-400">{BOQ_COPY.unplanned}</span>;
}

/**
 * The three programme fields, on the row they belong to (025 FR-009, FR-011, FR-014).
 *
 * **An empty box clears the field; it does not leave it alone.** The form starts from what the line
 * already carries, so an untouched box sends back what was there and a box the planner empties
 * sends `null` — which is what the API distinguishes, and what a planner removing a wrong finish
 * date has no other way to say.
 *
 * **The start date is here because `Avg / day` is derived from it.** That column reported *Not
 * planned* on every line of every project, including hand-added ones, because nothing in this
 * application ever set a start date — the API has accepted one since 008.
 */
function PlanRow({
  item,
  saving,
  onCancel,
  onSave,
}: {
  item: BoqItem;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: Parameters<typeof planBOQItem>[2]) => void;
}) {
  const asDay = (value: string | null) => (value ? value.slice(0, 10) : '');
  const [startDate, setStartDate] = useState(asDay(item.startDate));
  const [finishDate, setFinishDate] = useState(asDay(item.finishDate));
  const [perDayQty, setPerDayQty] = useState(
    item.perDayQty === null ? '' : String(item.perDayQty),
  );

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          startDate: startDate || null,
          finishDate: finishDate || null,
          perDayQty: perDayQty.trim() || null,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">{BOQ_COPY.startDate}</span>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">{BOQ_COPY.finishDate}</span>
        <input
          type="date"
          value={finishDate}
          onChange={(event) => setFinishDate(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">{BOQ_COPY.perDay}</span>
        <input
          inputMode="decimal"
          value={perDayQty}
          onChange={(event) => setPerDayQty(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
          placeholder={item.unit}
        />
      </label>

      <div className="flex items-center gap-2 pb-1">
        <RowAction type="submit" disabled={saving}>
          {saving ? BOQ_COPY.saving : BOQ_COPY.save}
        </RowAction>
        <RowAction type="button" intent="read" onClick={onCancel}>
          {BOQ_COPY.cancel}
        </RowAction>
      </div>

      <p className="w-full text-xs text-gray-500">{BOQ_COPY.planHint}</p>
    </form>
  );
}
