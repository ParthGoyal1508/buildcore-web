'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  composeClientBill,
  getBillableBoq,
  type BillableBoqItem,
} from '@/app/lib/api/billing';
import {
  billTotals,
  lineTotals,
  percentLabel,
  retentionOn,
} from '@/app/lib/bill-totals';
import {
  clearDraft,
  clientDraftKey,
  draftHasEntry,
  readDraft,
  saveDraft,
  type BillDraft,
} from '@/app/lib/bill-drafts';
import { BILLING_COPY, MESSAGES } from '@/app/lib/constants';
import { dateTimeLabel, rupees, todayIso } from '@/app/lib/format';
import BillLineRow from '@/app/ui/projects/bill-line-row';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * The client bill sheet (018 US1, FR-001 to FR-006 — `bugs.md` item 11).
 *
 * ## Not `ResponsiveList`, deliberately (T015)
 *
 * `app/ui/settings/responsive-list.tsx` renders every row and, since 017, an always-rendered detail
 * row beneath each. Both are right for a settings list of twenty and wrong for 300 lines of editable
 * inputs. It stays the right tool for the bills list below the sheet.
 *
 * ## A heading is a heading (T057)
 *
 * The real BOQ is two levels: 83 headings across 312 rows. A heading carries no quantity and no rate
 * and is rendered as a heading — never as a line of zeros, because a zero quantity on a heading reads
 * as a real measured quantity of nothing.
 *
 * ## Two totals, and the percentage goes on once (T058)
 *
 * The schedule total is at the BOQ's own rates; the quoted total is that figure plus the bidder's
 * quoted excess, applied **once to the total**. The client's file carries both figures, so this is
 * checkable: ₹2,99,61,506.78 becomes ₹3,06,98,559.85 at 2.46%. Applying the percentage per line and
 * summing is wrong by rounding — close enough to pass a glance, which is the worst available outcome
 * for a tender document.
 *
 * ## Per-row state, and what that costs here
 *
 * Each `BillLineRow` owns its typed value (NFR-001). The consequence for this component is that it
 * cannot read the rows' values from state during render — it keeps them in a ref, updated when a row
 * settles, and holds one `totalsVersion` counter to re-render the totals strip. That is the trade:
 * one deliberate re-render of the totals per settled line, instead of one re-render of 300 inputs per
 * keystroke.
 */
export default function BillSheet({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const boq = useQuery({
    queryKey: ['billableBoq', projectId],
    queryFn: () => getBillableBoq(projectId),
  });

  /**
   * Measured quantities and over-scope reasons, as they stand when each line **settles**.
   *
   * State, not a ref — a ref read during render is unsafe under the React compiler, and the totals
   * strip has to read these. The per-row architecture is what keeps that affordable: a *keystroke*
   * stays inside `BillLineRow`, and this state changes once per **settled line** (blur or Enter).
   * The memoized rows then skip the re-render, because their props are primitives that did not
   * change.
   *
   * The mirror refs exist only so an event handler can compute the next value and write a draft
   * without waiting for a render. Written and read in handlers, never during render.
   */
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const quantitiesRef = useRef<Record<string, number>>({});
  const reasonsRef = useRef<Record<string, string>>({});

  const [billNumber, setBillNumber] = useState('');
  const [billingDate, setBillingDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [retentionPercent, setRetentionPercent] = useState('');
  const [error, setError] = useState<string | null>(null);
  /**
   * A rejected save that somebody else's change caused (FR-014).
   *
   * Held apart from `error` because the recovery is different: an ordinary refusal is something to
   * fix in the entry, a conflict is something to look at elsewhere and then decide. **Nothing typed
   * is discarded either way** — losing an hour of measurement to a conflict dialog would be a worse
   * failure than the overwrite the rule prevents.
   */
  const [conflict, setConflict] = useState(false);
  /**
   * The header fields, mirrored for the draft writer.
   *
   * So that `persistDraft` and `onQuantityChange` can have empty dependency arrays and stay stable
   * across renders. A callback whose identity changed on every header keystroke would be new props
   * on 300 memoized rows — the same defect as a shared form object, arriving through the back door.
   */
  const headerRef = useRef({ billNumber: '', billingDate: todayIso(), description: '' });

  // --- Draft recovery (FR-005) -----------------------------------------------
  const draftKey = clientDraftKey(projectId);
  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [draftGeneration, setDraftGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readDraft(draftKey).then((found) => {
      // Offered, never applied. Restoring silently over a server state the user has not seen is
      // how yesterday's unsaved numbers come to look like today's bill.
      if (!cancelled && draftHasEntry(found)) setDraft(found);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  /**
   * The rendered order of the measurable lines, for keyboard navigation (FR-004).
   *
   * Derived from the loaded BOQ rather than assembled as a second list, so the order Enter follows
   * is the order on screen. A memo and not a ref written during render: the data changes once, when
   * the schedule loads, so `onEnterNext` is stable for every keystroke after that.
   */
  const order = useMemo(
    () =>
      (boq.data?.groups ?? []).flatMap((group) =>
        group.items.map((item) => item.id),
      ),
    [boq.data],
  );

  const registerInput = useCallback(
    (id: string, element: HTMLInputElement | null) => {
      inputs.current[id] = element;
    },
    [],
  );

  const persistDraft = useCallback(() => {
    void saveDraft({
      key: draftKey,
      quantities: quantitiesRef.current,
      reasons: reasonsRef.current,
      header: { ...headerRef.current },
    });
  }, [draftKey]);

  const onQuantityChange = useCallback(
    (id: string, quantity: number) => {
      const next = { ...quantitiesRef.current };
      if (quantity > 0) next[id] = quantity;
      else delete next[id];
      quantitiesRef.current = next;
      setQuantities(next);
      persistDraft();
    },
    [persistDraft],
  );

  const onReasonChange = useCallback(
    (id: string, reason: string) => {
      const next = { ...reasonsRef.current };
      if (reason.trim()) next[id] = reason.trim();
      else delete next[id];
      reasonsRef.current = next;
      setReasons(next);
      persistDraft();
    },
    [persistDraft],
  );

  /** FR-004: Enter moves down the column, skipping headings and unpriced lines. */
  const onEnterNext = useCallback(
    (id: string) => {
      const index = order.indexOf(id);
      for (let next = index + 1; next < order.length; next += 1) {
        const element = inputs.current[order[next]];
        // Skips an unpriced line rather than parking the cursor in a disabled input: a biller
        // pressing Enter down a column should not have to notice why nothing happened.
        if (element && !element.disabled) {
          element.focus();
          element.select();
          return;
        }
      }
    },
    [order],
  );

  const compose = useMutation({
    mutationFn: () =>
      composeClientBill({
        projectId,
        billNumber: billNumber.trim(),
        billingDate,
        description: description.trim() || undefined,
        retentionPercent: retentionPercent
          ? Number(retentionPercent) / 100
          : undefined,
        lines: Object.entries(quantitiesRef.current).map(([id, quantity]) => ({
          boqTaskItemId: id,
          quantity,
          overScopeReason: reasonsRef.current[id],
        })),
      }),
    onSuccess: () => {
      // The typing has become a real bill, so the draft has served its purpose.
      void clearDraft(draftKey);
      quantitiesRef.current = {};
      reasonsRef.current = {};
      setQuantities({});
      setReasons({});
      setBillNumber('');
      headerRef.current = { ...headerRef.current, billNumber: '' };
      void queryClient.invalidateQueries({ queryKey: ['clientBills', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['billableBoq', projectId] });
    },
    onError: (err) => {
      // 409 is the only status where the remedy is "look at the current state", so it is the only
      // one that changes the shape of what the screen offers.
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
        setError(err.message);
        return;
      }
      setError(
        err instanceof ApiError ? err.message : BILLING_COPY.composeFailed,
      );
    },
  });

  if (boq.isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {BILLING_COPY.boqLoading}
      </p>
    );
  }
  if (boq.isError || !boq.data) {
    return <FormError message={BILLING_COPY.boqLoadFailed} />;
  }
  if (boq.data.groups.length === 0) {
    return <p className="text-sm text-gray-600">{BILLING_COPY.boqEmpty}</p>;
  }

  const { quotedPercentage, estimatedTotal, quotedTotal, unpricedCount } =
    boq.data;

  const measured = boq.data.groups
    .flatMap((group) => group.items)
    .filter((item) => (quantities[item.id] ?? 0) > 0);

  const perLine = measured.map((item) =>
    lineTotals(
      {
        quantity: quantities[item.id] ?? 0,
        rate: item.rate,
        previouslyBilledQty: item.previouslyBilledQty,
        scopeQty: item.scopeQty,
      },
      quotedPercentage,
    ),
  );
  const grossOnly = billTotals(perLine);
  const retentionFraction = retentionPercent
    ? Number(retentionPercent) / 100
    : 0;
  const totals = billTotals(perLine, {
    retention: retentionOn(grossOnly.gross, retentionFraction),
  });

  const missingReason = measured.some(
    (item) =>
      lineTotals(
        {
          quantity: quantities[item.id] ?? 0,
          rate: item.rate,
          previouslyBilledQty: item.previouslyBilledQty,
          scopeQty: item.scopeQty,
        },
        quotedPercentage,
      ).exceedsScope && !reasons[item.id],
  );

  return (
    <section className="space-y-4">
      {draft && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-900">{BILLING_COPY.draftFound}</p>
          <p className="mt-1 text-blue-800">{BILLING_COPY.draftFoundHint}</p>
          <p className="mt-1 text-xs text-blue-700">
            {BILLING_COPY.draftSaved(dateTimeLabel(draft.savedAt))}
          </p>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
            <SecondaryButton
              type="button"
              onClick={() => {
                void clearDraft(draftKey);
                setDraft(null);
              }}
            >
              {BILLING_COPY.draftDiscard}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                quantitiesRef.current = { ...draft.quantities };
                reasonsRef.current = { ...(draft.reasons ?? {}) };
                setQuantities({ ...draft.quantities });
                setReasons({ ...(draft.reasons ?? {}) });
                headerRef.current = {
                  billNumber: draft.header?.billNumber ?? '',
                  billingDate: draft.header?.billingDate ?? todayIso(),
                  description: draft.header?.description ?? '',
                };
                setBillNumber(headerRef.current.billNumber);
                setBillingDate(headerRef.current.billingDate);
                setDescription(headerRef.current.description);
                // Changing the rows' keys remounts them, which is the only way to replace row-local
                // state without also being able to overwrite what somebody is typing.
                setDraftGeneration((generation) => generation + 1);
                setDraft(null);
              }}
            >
              {BILLING_COPY.draftRestore}
            </SecondaryButton>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {BILLING_COPY.boqHeading}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{BILLING_COPY.boqHint}</p>
        {unpricedCount > 0 && (
          <p className="mt-1 text-sm text-amber-900">
            {BILLING_COPY.unpricedCount(unpricedCount)}{' '}
            {BILLING_COPY.unpricedHint}
          </p>
        )}
      </div>

      {/*
        NFR-003: the grid scrolls inside its own container, on **both** axes.

        It was `overflow-x-auto` alone, so the rows were never bounded vertically. That is
        invisible on a short schedule and ruinous on a real one: the client's own 231-line tender
        renders rows up to 1,173px tall — the CCTV and NVR items carry a full specification as
        their description — and the grid came to 48,345px, which pushed the document to 49,201px
        against an 813px viewport. Sixty screens of scrolling, most of it past the end of the page,
        with the shell clipped behind it.

        The header sticks, because a column heading that scrolls away over two hundred rows leaves
        somebody typing quantities into a grid whose columns they can no longer name.
      */}
      <div className="max-h-[70vh] overflow-auto rounded border border-gray-200">
        <table className="min-w-[56rem] w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600 shadow-[0_1px_0_0_rgb(229,231,235)]">
            <tr>
              <th className="px-2 py-2">{BILLING_COPY.columns.boqNo}</th>
              <th className="px-2 py-2">{BILLING_COPY.columns.task}</th>
              <th className="px-2 py-2">{BILLING_COPY.columns.unit}</th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.columns.scopeQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.columns.billedQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.columns.remainingQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.columns.rate}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.columns.quantity}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.columns.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {boq.data.groups.map((group) => (
              <HeadingAndItems
                key={group.id}
                boqNo={group.boqNo}
                name={group.name}
                items={group.items}
                quotedPercentage={quotedPercentage}
                settled={quantities}
                draftGeneration={draftGeneration}
                onQuantityChange={onQuantityChange}
                onReasonChange={onReasonChange}
                onEnterNext={onEnterNext}
                registerInput={registerInput}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <dl className="space-y-1 rounded border border-gray-200 p-3 text-sm">
          <Figure label={BILLING_COPY.estimatedTotal} value={estimatedTotal} />
          <Figure label={BILLING_COPY.quotedTotal} value={quotedTotal} />
          <p className="pt-1 text-xs text-gray-500">
            {BILLING_COPY.quotedPercentageNote(percentLabel(quotedPercentage))}
          </p>
        </dl>

        <dl className="space-y-1 rounded border border-gray-200 p-3 text-sm">
          <Figure label={BILLING_COPY.gross} value={totals.gross} />
          <Figure label={BILLING_COPY.retention} value={totals.retention} />
          <Figure
            label={BILLING_COPY.deductionTotal}
            value={totals.deductionTotal}
          />
          <Figure label={BILLING_COPY.net} value={totals.net} strong />
          <p className="pt-1 text-xs text-gray-500">
            {BILLING_COPY.deductionsAreNotCost}
          </p>
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="bill-number"
          label={BILLING_COPY.billNumberLabel}
          value={billNumber}
          onChange={(event) => {
            setBillNumber(event.target.value);
            headerRef.current.billNumber = event.target.value;
          }}
          onBlur={persistDraft}
        />
        <TextField
          id="billing-date"
          type="date"
          label={BILLING_COPY.billingDateLabel}
          value={billingDate}
          onChange={(event) => {
            setBillingDate(event.target.value);
            headerRef.current.billingDate = event.target.value;
          }}
          onBlur={persistDraft}
        />
        <TextField
          id="bill-description"
          label={BILLING_COPY.descriptionLabel}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            headerRef.current.description = event.target.value;
          }}
          onBlur={persistDraft}
        />
        <TextField
          id="retention-percent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          label={BILLING_COPY.retentionPercentLabel}
          value={retentionPercent}
          onChange={(event) => setRetentionPercent(event.target.value)}
        />
      </div>

      {conflict && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-amber-900">
            {BILLING_COPY.conflictHeading}
          </p>
          <p className="mt-1 text-amber-900">{BILLING_COPY.conflictHint}</p>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
            <SecondaryButton
              type="button"
              onClick={() => setConflict(false)}
            >
              {BILLING_COPY.conflictKeep}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                // Refetches the schedule — the cumulative column is what a colleague's bill moved
                // — while the typed quantities stay exactly where they are.
                void queryClient.invalidateQueries({
                  queryKey: ['billableBoq', projectId],
                });
                setConflict(false);
              }}
            >
              {BILLING_COPY.conflictReload}
            </SecondaryButton>
          </div>
        </div>
      )}

      <FormError message={error} />
      {measured.length === 0 && (
        <p className="text-sm text-gray-600">{BILLING_COPY.nothingMeasured}</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          disabled={
            measured.length === 0 || !billNumber.trim() || compose.isPending
          }
          onClick={() => {
            setError(null);
            compose.mutate();
          }}
        >
          {compose.isPending ? BILLING_COPY.composing : BILLING_COPY.compose}
        </Button>
      </div>
      {/*
        Said at compose time rather than withheld until submit: over-scope is tolerated on a draft
        (FR-003) and refused at submit without a reason, so a biller who has not given one should
        learn it here, while they still remember the measurement.
      */}
      {missingReason && (
        <p className="text-sm text-amber-900">
          {BILLING_COPY.overQuantityReasonMissing}
        </p>
      )}
      {compose.isError && !error && (
        <FormError message={MESSAGES.loadFailed} />
      )}
    </section>
  );
}

/**
 * One BOQ heading and the lines under it.
 *
 * A separate component so the heading row and its items share one `key` boundary, and so the
 * heading's own markup cannot accidentally gain a quantity column.
 */
function HeadingAndItems({
  boqNo,
  name,
  items,
  quotedPercentage,
  settled,
  draftGeneration,
  onQuantityChange,
  onReasonChange,
  onEnterNext,
  registerInput,
}: {
  boqNo: string;
  name: string;
  items: BillableBoqItem[];
  quotedPercentage: number;
  settled: Record<string, number>;
  draftGeneration: number;
  onQuantityChange: (id: string, quantity: number) => void;
  onReasonChange: (id: string, reason: string) => void;
  onEnterNext: (id: string) => void;
  registerInput: (id: string, element: HTMLInputElement | null) => void;
}) {
  return (
    <>
      <tr className="border-b border-gray-200 bg-gray-100">
        {/*
          Spans the whole row on purpose. A heading with empty cells under the quantity and rate
          columns invites somebody to type in them, and a zero there would read as a measured
          quantity of nothing.
        */}
        <th
          scope="colgroup"
          colSpan={9}
          className="px-2 py-1.5 text-left text-sm font-semibold text-gray-900"
        >
          <span className="font-mono text-xs text-gray-600">{boqNo}</span>{' '}
          {name}
        </th>
      </tr>
      {items.map((item) => (
        <BillLineRow
          // The draft generation is part of the key so restoring a draft remounts the rows with
          // their new starting values. See `BillLineRow.initialQuantity`.
          key={`${item.id}:${draftGeneration}`}
          id={item.id}
          boqNo={item.boqNo}
          taskName={item.taskName}
          unit={item.unit}
          scopeQty={item.scopeQty}
          rate={item.rate}
          unpriced={item.unpriced}
          previouslyBilledQty={item.previouslyBilledQty}
          isVariation={item.isVariation}
          variationRef={item.variationRef}
          quotedPercentage={quotedPercentage}
          initialQuantity={settled[item.id]}
          onQuantityChange={onQuantityChange}
          onReasonChange={onReasonChange}
          onEnterNext={onEnterNext}
          registerInput={registerInput}
        />
      ))}
    </>
  );
}

function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-gray-600">{label}</dt>
      <dd
        className={
          strong
            ? 'font-semibold tabular-nums text-gray-900'
            : 'tabular-nums text-gray-900'
        }
      >
        {rupees(value)}
      </dd>
    </div>
  );
}
