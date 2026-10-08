'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  getAward,
  getBillableBoq,
  setAward,
  type BillableBoqItem,
} from '@/app/lib/api/billing';
import { ApiError } from '@/app/lib/api/client';
import { WORK_ORDER_COPY } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import SearchableSelect, {
  type SearchableOption,
} from '@/app/ui/searchable-select';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/** One row being edited. Quantities stay strings until save — a half-typed number is not a number. */
interface AwardRow {
  /** Local only. Never sent: the server replaces the award wholesale. */
  key: string;
  boqTaskItemId: string | null;
  description: string;
  unit: string;
  awardedQty: string;
  rate: string;
}

let nextKey = 0;
const freshKey = () => `row-${nextKey++}`;

/**
 * The award on one work order: what the subcontractor was given, line by line (027).
 *
 * ## Three ways in, because one award is three different jobs
 *
 * **From the BOQ.** Most of a subcontract is the client's own schedule handed down, so the line is
 * picked rather than retyped: the description, the unit and the scope quantity come across, and the
 * only thing left to enter is the rate. This is also the only path that sets `boqTaskItemId`, and
 * that id is load-bearing — `DwrService.assertNotBilledBelow` reaches the subcontractor-billed
 * quantity through it, so an unlinked line quietly drops out of the floor a daily-work reversal is
 * checked against.
 *
 * **Typed.** A subcontract routinely covers work the client's BOQ itemises differently — night
 * lighting, a hire charge, a lump sum — and the schema deliberately allows a line tied to nothing,
 * because "forcing a match would make somebody invent one".
 *
 * **Pasted.** A 60-line award arrives as a table in an email, and re-typing it into four boxes per
 * line is how it does not get entered at all. Paste appends rows the person then reviews, rather
 * than saving straight through: the old textarea *was* the save, so a mis-split line became the
 * award before anybody saw it.
 *
 * ## The subcontractor's rate is never prefilled
 *
 * The BOQ rate is what the client pays; the difference between the two is the margin on the work.
 * A prefilled field is one somebody accepts, and accepting this one sets the margin to zero without
 * anybody deciding it should be. It is shown in its own column for reference and left out of the
 * box.
 *
 * ## Editing, not replacing blind
 *
 * `setAward` replaces the award wholesale, which is why the old paste box carried a warning that
 * saving would wipe what was there. The rows are now seeded from the award that exists, so a
 * correction is an edit of the real lines and the warning is unnecessary — and `boqTaskItemId` is
 * read back and sent again, so correcting a rate cannot silently unlink the line.
 */
export default function AwardEditor({
  projectId,
  workOrderId,
  /**
   * Why this award cannot be edited, or null when it can.
   *
   * A message rather than a boolean, because there are now three reasons and they need different
   * things done about them: a bill exists (permanent), it is under review, or it is approved and
   * must be reopened. The server refuses all three; this says which before the attempt.
   */
  lockedBecause,
  onSaved,
  onError,
}: {
  projectId: string;
  workOrderId: string;
  lockedBecause: string | null;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const queryClient = useQueryClient();

  const award = useQuery({
    queryKey: ['raAward', workOrderId, null],
    queryFn: () => getAward(workOrderId),
  });

  // The BOQ is a convenience here, not a requirement: its failure must not take the typed and
  // pasted paths down with it, so this never blocks the editor.
  const boq = useQuery({
    queryKey: ['billableBoq', projectId],
    queryFn: () => getBillableBoq(projectId),
    retry: false,
  });

  /**
   * What the server says the award is. Derived, never copied into state by an effect — syncing
   * server data into state is how a stale award survives a refetch, and the lint rule here says so.
   */
  const saved = useMemo<AwardRow[] | null>(
    () =>
      award.data?.lines.map((line) => ({
        key: freshKey(),
        boqTaskItemId: line.boqTaskItemId,
        description: line.description,
        unit: line.unit,
        awardedQty: String(line.awardedQty),
        rate: String(line.rate),
      })) ?? null,
    [award.data],
  );

  /** Only what the person has changed. `null` means "untouched", so the saved award shows through. */
  const [draft, setDraft] = useState<AwardRow[] | null>(null);
  const rows = draft ?? saved;

  const [pasteText, setPasteText] = useState('');
  const [pickerValue, setPickerValue] = useState('');

  /** Every edit starts from whatever is on screen — the draft if there is one, the award if not. */
  const edit = (fn: (current: AwardRow[]) => AwardRow[]) =>
    setDraft((current) => fn(current ?? saved ?? []));

  const boqItems = useMemo<BillableBoqItem[]>(
    () => (boq.data?.groups ?? []).flatMap((group) => group.items),
    [boq.data],
  );
  const boqById = useMemo(
    () => new Map(boqItems.map((item) => [item.id, item])),
    [boqItems],
  );

  const used = useMemo(
    () =>
      new Set(
        (rows ?? [])
          .map((row) => row.boqTaskItemId)
          .filter((id): id is string => id !== null),
      ),
    [rows],
  );

  const options = useMemo<SearchableOption[]>(
    () =>
      boqItems.map((item) => ({
        id: item.id,
        label: item.boqNo,
        sublabel: item.taskName,
        // A line already on the award is listed and marked rather than hidden: a BOQ number missing
        // from the list reads as a BOQ number that does not exist.
        note: used.has(item.id)
          ? `${item.unit} · ${WORK_ORDER_COPY.awardBoqAlreadyAdded}`
          : `${item.unit} · ${item.scopeQty}`,
      })),
    [boqItems, used],
  );

  const update = (key: string, patch: Partial<AwardRow>) =>
    edit((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const addFromBoq = (id: string) => {
    const item = boqById.get(id);
    setPickerValue('');
    if (!item || used.has(id)) return;
    edit((current) => [
      ...current,
      {
        key: freshKey(),
        boqTaskItemId: item.id,
        description: item.taskName,
        unit: item.unit,
        awardedQty: String(item.scopeQty),
        // Left empty on purpose. See the rate note above.
        rate: '',
      },
    ]);
  };

  /** `description | unit | quantity | rate`, tab or pipe. Appends; never saves. */
  const addPasted = () => {
    const parsed = pasteText
      .split('\n')
      .map((line) => line.split(/\t|\|/).map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 4 && cells[0])
      .map((cells) => ({
        key: freshKey(),
        boqTaskItemId: null,
        description: cells[0],
        unit: cells[1],
        awardedQty: cells[2],
        rate: cells[3],
      }));
    if (parsed.length === 0) {
      onError(WORK_ORDER_COPY.awardUnparseable);
      return;
    }
    onError(null);
    setPasteText('');
    edit((current) => [...current, ...parsed]);
  };

  const save = useMutation({
    mutationFn: () => {
      const current = rows ?? [];
      if (current.length === 0) {
        throw new ApiError(WORK_ORDER_COPY.awardNothingToSave, 400);
      }
      const lines = current.map((row, index) => {
        const awardedQty = Number(row.awardedQty);
        const rate = Number(row.rate);
        if (
          !row.description.trim() ||
          !row.unit.trim() ||
          row.awardedQty.trim() === '' ||
          row.rate.trim() === '' ||
          !Number.isFinite(awardedQty) ||
          !Number.isFinite(rate)
        ) {
          throw new ApiError(WORK_ORDER_COPY.awardRowIncomplete(index + 1), 400);
        }
        return {
          description: row.description.trim(),
          unit: row.unit.trim(),
          awardedQty,
          rate,
          // Sent back exactly as it was read, so correcting a rate cannot unlink the line.
          ...(row.boqTaskItemId ? { boqTaskItemId: row.boqTaskItemId } : {}),
        };
      });
      return setAward(workOrderId, lines);
    },
    onSuccess: () => {
      onError(null);
      // The draft is dropped so the table re-derives from what the server actually stored, rather
      // than continuing to show what was sent to it.
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ['raAward', workOrderId] });
      onSaved();
    },
    onError: (err) =>
      onError(err instanceof ApiError ? err.message : String(err)),
  });

  if (award.isLoading || rows === null) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {WORK_ORDER_COPY.awardLoading}
      </p>
    );
  }

  const total = rows.reduce((sum, row) => {
    const amount = Number(row.awardedQty) * Number(row.rate);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return (
    <div className="space-y-4">
      {lockedBecause !== null && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          {lockedBecause}
        </p>
      )}

      {lockedBecause === null && (
        <div className="space-y-3 rounded border border-gray-200 p-3">
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {WORK_ORDER_COPY.awardAddFromBoq}
            </span>
            {boq.isError ? (
              <p className="text-sm text-amber-900">
                {WORK_ORDER_COPY.awardBoqUnavailable}
              </p>
            ) : boqItems.length === 0 && !boq.isLoading ? (
              <p className="text-sm text-gray-600">
                {WORK_ORDER_COPY.awardNoBoq}
              </p>
            ) : (
              <SearchableSelect
                value={pickerValue}
                onChange={addFromBoq}
                options={options}
                placeholder={
                  boq.isLoading
                    ? WORK_ORDER_COPY.awardBoqLoading
                    : WORK_ORDER_COPY.awardBoqPickerPlaceholder
                }
                disabled={boq.isLoading}
              />
            )}
            <p className="mt-1 text-xs text-gray-500">
              {WORK_ORDER_COPY.awardLinkedHint}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                edit((current) => [
                  ...current,
                  {
                    key: freshKey(),
                    boqTaskItemId: null,
                    description: '',
                    unit: '',
                    awardedQty: '',
                    rate: '',
                  },
                ])
              }
            >
              {WORK_ORDER_COPY.awardAddBlank}
            </SecondaryButton>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-blue-700">
              {WORK_ORDER_COPY.awardPasteDisclosure}
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-gray-600">
                {WORK_ORDER_COPY.awardHint}
              </p>
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={5}
                aria-label={WORK_ORDER_COPY.awardLabel}
                className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
                placeholder={WORK_ORDER_COPY.awardPlaceholder}
              />
              <SecondaryButton
                type="button"
                disabled={!pasteText.trim()}
                onClick={addPasted}
              >
                {WORK_ORDER_COPY.awardPasteAdd}
              </SecondaryButton>
            </div>
          </details>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">{WORK_ORDER_COPY.awardEmptyRows}</p>
      ) : (
        /* Scrolls inside itself. Six columns of a 231-line schedule will not fit a panel beside a
           list, and a table that widens the page makes every other screen scroll sideways too. */
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-2 py-2">{WORK_ORDER_COPY.awardColumns.boq}</th>
                <th className="px-2 py-2">
                  {WORK_ORDER_COPY.awardColumns.description}
                </th>
                <th className="px-2 py-2">
                  {WORK_ORDER_COPY.awardColumns.unit}
                </th>
                <th className="px-2 py-2 text-right">
                  {WORK_ORDER_COPY.awardColumns.quantity}
                </th>
                <th className="px-2 py-2 text-right">
                  {WORK_ORDER_COPY.awardColumns.boqRate}
                </th>
                <th className="px-2 py-2 text-right">
                  {WORK_ORDER_COPY.awardColumns.rate}
                </th>
                <th className="px-2 py-2 text-right">
                  {WORK_ORDER_COPY.awardColumns.amount}
                </th>
                {lockedBecause === null && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = row.boqTaskItemId
                  ? boqById.get(row.boqTaskItemId)
                  : undefined;
                const amount = Number(row.awardedQty) * Number(row.rate);
                return (
                  <tr key={row.key} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 tabular-nums text-gray-600">
                      {/* The number where there is one. A linked line that the BOQ read could not
                          resolve still shows as linked rather than as a free line. */}
                      {item?.boqNo ??
                        (row.boqTaskItemId
                          ? '•'
                          : WORK_ORDER_COPY.awardUnlinked)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={row.description}
                        disabled={lockedBecause !== null}
                        aria-label={WORK_ORDER_COPY.awardColumns.description}
                        onChange={(event) =>
                          update(row.key, { description: event.target.value })
                        }
                        className="w-full min-w-[16rem] rounded border border-gray-300 px-2 py-1 disabled:border-transparent disabled:bg-transparent"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={row.unit}
                        disabled={lockedBecause !== null}
                        aria-label={WORK_ORDER_COPY.awardColumns.unit}
                        onChange={(event) =>
                          update(row.key, { unit: event.target.value })
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 disabled:border-transparent disabled:bg-transparent"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        value={row.awardedQty}
                        disabled={lockedBecause !== null}
                        inputMode="decimal"
                        aria-label={WORK_ORDER_COPY.awardColumns.quantity}
                        onChange={(event) =>
                          update(row.key, { awardedQty: event.target.value })
                        }
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-right tabular-nums disabled:border-transparent disabled:bg-transparent"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                      {/* Reference only. Never copied into the next column — see the rate note. */}
                      {item ? rupees(item.rate) : WORK_ORDER_COPY.awardUnlinked}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        value={row.rate}
                        disabled={lockedBecause !== null}
                        inputMode="decimal"
                        aria-label={WORK_ORDER_COPY.awardColumns.rate}
                        onChange={(event) =>
                          update(row.key, { rate: event.target.value })
                        }
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-right tabular-nums disabled:border-transparent disabled:bg-transparent"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                      {Number.isFinite(amount) ? rupees(amount) : '—'}
                    </td>
                    {lockedBecause === null && (
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          aria-label={WORK_ORDER_COPY.awardRemoveRow}
                          title={WORK_ORDER_COPY.awardRemoveRow}
                          onClick={() =>
                            edit((current) =>
                              current.filter((other) => other.key !== row.key),
                            )
                          }
                          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-gray-300 bg-gray-50">
              <tr>
                <td colSpan={6} className="px-2 py-2 font-medium text-gray-900">
                  {WORK_ORDER_COPY.awardTotal}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900">
                  {rupees(total)}
                </td>
                {lockedBecause === null && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {lockedBecause === null && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              onError(null);
              save.mutate();
            }}
          >
            {save.isPending
              ? WORK_ORDER_COPY.awardSaving
              : WORK_ORDER_COPY.awardSaveChanges}
          </Button>
          <SecondaryButton
            type="button"
            disabled={save.isPending}
            onClick={() => {
              onError(null);
              setDraft(null);
              setPasteText('');
            }}
          >
            {WORK_ORDER_COPY.awardDiscard}
          </SecondaryButton>
          <span className="text-xs text-gray-500">
            {WORK_ORDER_COPY.awardRateHint}
          </span>
        </div>
      )}
    </div>
  );
}
