'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteBOQItem,
  getBOQ,
  planBOQItem,
  type BoqGroup,
  type BoqItem,
} from '@/app/lib/api/projects';
import { BOQ_COPY } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { useProjectLock } from '@/app/ui/projects/project-lock-context';
import { RowAction } from '@/app/ui/settings/form-fields';

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', projectId, 'boq'],
    queryFn: () => getBOQ(projectId),
  });

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
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq-alerts'] });
      setPlanning(null);
      setError(null);
    },
    // The server names every refusal it gives — a finish date before the start date says which two
    // dates contradict each other — so its sentence is worth more than anything written here.
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => deleteBOQItem(projectId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
      // The alert tabs read the same lines through a different endpoint, so they go stale with it.
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq-alerts'] });
      setError(null);
    },
    onError: (err: Error) =>
      setError(err instanceof ApiError ? BOQ_COPY.deleteBlocked : err.message),
  });

  const toggle = (groupId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  if (isLoading) return <p className="text-sm text-gray-500">{BOQ_COPY.loading}</p>;
  if (isError) return <p className="text-sm text-red-700">{BOQ_COPY.loadFailed}</p>;

  // One read serves both tabs: the query key is the same, so switching tabs costs no request.
  const groups = (data ?? []).filter((group) => group.isEstimate === isEstimate);

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

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[60rem] w-full text-sm">
          <caption className="sr-only">{BOQ_COPY.heading}</caption>
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnBoqNo}</th>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnTask}</th>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnUnit}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnScope}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.rate}</th>
              {isEstimate ? (
                <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnAmount}</th>
              ) : (
                <>
                  <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnDone}</th>
                  <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnPending}</th>
                  <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnPerDay}</th>
                  <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnAvgPerDay}</th>
                  <th scope="col" className="px-3 py-2">{BOQ_COPY.columnFinish}</th>
                </>
              )}
              {!isLocked && <th scope="col" className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group.id}
                group={group}
                isEstimate={isEstimate}
                collapsed={collapsed.has(group.id)}
                onToggle={() => toggle(group.id)}
                onDelete={isLocked ? null : (itemId) => remove.mutate(itemId)}
                planningId={planning}
                onPlanOpen={isLocked ? null : setPlanning}
                onPlanSave={(itemId, input) => plan.mutate({ itemId, input })}
                planSaving={plan.isPending}
              />
            ))}
          </tbody>
          {isEstimate && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <th
                  scope="row"
                  colSpan={5}
                  className="px-3 py-2 text-right font-semibold text-gray-900"
                >
                  {BOQ_COPY.estimateTotal}
                </th>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                  {rupees(estimatedTotal)}
                </td>
                {!isLocked && <td className="px-3 py-2" />}
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
  onPlanSave: (itemId: string, input: Parameters<typeof planBOQItem>[2]) => void;
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
            className="flex items-center gap-2 font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
          <tr className="border-t border-gray-100">
            <td className="px-3 py-2 text-gray-500 tabular-nums">{item.boqNo}</td>
            <td className="px-3 py-2 text-gray-900">
              {item.taskName}
              {item.isVariation && (
                <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                  {BOQ_COPY.variation}
                </span>
              )}
            </td>
            {/* FR-030: exactly as the client spelled it. Tidying `R. mtr` to `R.Mtr.` creates a
                difference they cannot trace against their own sheet. */}
            <td className="px-3 py-2 text-gray-700">{item.unit}</td>
            <td className="px-3 py-2 text-right tabular-nums">{item.scopeQty.toFixed(3)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{rupees(item.rate)}</td>
            {isEstimate ? (
              <td className="px-3 py-2 text-right tabular-nums">
                {rupees(item.scopeQty * item.rate)}
              </td>
            ) : (
              <>
                <td className="px-3 py-2 text-right tabular-nums">{item.doneQty.toFixed(3)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.pendingQty.toFixed(3)}</td>
                <Programme value={item.perDayQty} />
                <Programme value={item.avgQtyPerDay} />
                <td className="px-3 py-2">
                  {item.finishDate ? (
                    new Date(item.finishDate).toLocaleDateString()
                  ) : (
                    <Unplanned />
                  )}
                </td>
              </>
            )}
            {onDelete && (
              <td className="px-3 py-2">
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
                  <RowAction onClick={() => onDelete(item.id)}>{BOQ_COPY.deleteLine}</RowAction>
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
    <td className="px-3 py-2 text-right tabular-nums">
      {value === null ? <Unplanned /> : value.toFixed(3)}
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
