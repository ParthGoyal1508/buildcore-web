'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createWorkOrder,
  getRaBills,
  getWorkOrders,
  updateWorkOrder,
  setAward,
  submitRaBill,
  type RaBill,
} from '@/app/lib/api/billing';
import { BILLING_COPY, WORK_ORDER_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import RaBillSheet from '@/app/ui/projects/ra-bill-sheet';
import RetentionLedger from '@/app/ui/projects/retention-ledger';
import {
  FieldLabelSpacer,
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Subcontractor bills for one project (018 US2 — `bugs.md` item 12).
 *
 * Three things on one screen, in the order the work happens: the work orders, the award captured
 * against the chosen one, and the bills measured against that award. Splitting them would mean
 * holding a remaining quantity in your head while moving between pages.
 *
 * ## Revising is where the approval rule lives (FR-009)
 *
 * Opening a submitted or certified bill in the sheet shows the warning **before** anything can be
 * edited, because the warning is the requirement. The sheet handles that; this panel's job is to put
 * the bill into it rather than offering an inline edit that would bypass the warning.
 */
export default function RaBillsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [revising, setRevising] = useState<RaBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOrder, setNewOrder] = useState({ workDetail: '', retention: '' });
  const [awardText, setAwardText] = useState('');

  const orders = useQuery({
    queryKey: ['workOrders', projectId],
    queryFn: () => getWorkOrders(projectId),
  });
  const bills = useQuery({
    queryKey: ['raBills', projectId],
    queryFn: () => getRaBills(projectId),
  });

  const chosen =
    orders.data?.find((order) => order.id === selected) ?? orders.data?.[0];

  const raise = useMutation({
    mutationFn: () =>
      createWorkOrder({
        projectId,
        workDetail: newOrder.workDetail.trim(),
        retentionPercent: newOrder.retention
          ? Number(newOrder.retention) / 100
          : undefined,
        status: 'active',
      }),
    onSuccess: (order) => {
      setNewOrder({ workDetail: '', retention: '' });
      setSelected(order.id);
      void queryClient.invalidateQueries({ queryKey: ['workOrders', projectId] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : WORK_ORDER_COPY.raiseFailed),
  });

  /**
   * The award, captured as pasted lines.
   *
   * `description | unit | quantity | rate` per line, because a subcontract award arrives as a
   * table in an email or a PDF and re-typing it into four inputs per line is how a 60-line award
   * does not get entered at all. Deliberately not a file import: the award's shape varies by
   * subcontractor, and an importer that guessed wrong would be worse than a paste the person can
   * see before they save it.
   */
  const captureAward = useMutation({
    mutationFn: () => {
      const lines = awardText
        .split('\n')
        .map((row) => row.split(/\t|\|/).map((cell) => cell.trim()))
        .filter((cells) => cells.length >= 4 && cells[0])
        .map((cells) => ({
          description: cells[0],
          unit: cells[1],
          awardedQty: Number(cells[2]),
          rate: Number(cells[3]),
        }))
        .filter(
          (line) =>
            Number.isFinite(line.awardedQty) && Number.isFinite(line.rate),
        );
      if (lines.length === 0) {
        throw new ApiError(
          WORK_ORDER_COPY.awardUnparseable,
          400,
        );
      }
      return setAward(chosen?.id ?? '', lines);
    },
    onSuccess: () => {
      setAwardText('');
      void queryClient.invalidateQueries({ queryKey: ['workOrders', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['raAward', chosen?.id] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : WORK_ORDER_COPY.awardUnparseable),
  });

  const submit = useMutation({
    mutationFn: (id: string) => submitRaBill(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['raBills', projectId] }),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : BILLING_COPY.submitFailed),
  });

  return (
    <div className="space-y-8">
      <FormError message={error} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          {WORK_ORDER_COPY.heading}
        </h2>
        {orders.isLoading && (
          <p className="text-sm text-gray-500" role="status">
            {WORK_ORDER_COPY.loading}
          </p>
        )}
        {orders.data && orders.data.length === 0 && (
          <p className="text-sm text-gray-600">{WORK_ORDER_COPY.empty}</p>
        )}
        {orders.data && orders.data.length > 0 && (
          <ul className="space-y-2">
            {orders.data.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(order.id);
                    setRevising(null);
                  }}
                  aria-pressed={chosen?.id === order.id}
                  className={`min-h-11 w-full rounded border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                    chosen?.id === order.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <span className="font-medium text-gray-900">
                    {order.workDetail}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">
                    {WORK_ORDER_COPY.summary(
                      `${(order.retentionPercent * 100).toFixed(2)}%`,
                      order.awardLineCount,
                      order.billCount,
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded border border-gray-200 p-3">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            {WORK_ORDER_COPY.newHeading}
          </h4>
          <div className="grid items-start gap-3 sm:grid-cols-3">
            <TextField
              id="wo-detail"
              label={WORK_ORDER_COPY.detailLabel}
              value={newOrder.workDetail}
              onChange={(event) =>
                setNewOrder((previous) => ({
                  ...previous,
                  workDetail: event.target.value,
                }))
              }
            />
            <TextField
              id="wo-retention"
              type="number"
              step="0.01"
              min="0"
              max="100"
              label={WORK_ORDER_COPY.retentionLabel}
              hint={WORK_ORDER_COPY.retentionHint}
              value={newOrder.retention}
              onChange={(event) =>
                setNewOrder((previous) => ({
                  ...previous,
                  retention: event.target.value,
                }))
              }
            />
            <div>
              {/* The retention field's hint runs to three lines, so an `items-end` row dropped this
                  button to the bottom of it, a long way under the inputs it belongs to. */}
              <FieldLabelSpacer />
              <Button
                type="button"
                disabled={!newOrder.workDetail.trim() || raise.isPending}
                onClick={() => {
                  setError(null);
                  raise.mutate();
                }}
              >
                {raise.isPending
                  ? WORK_ORDER_COPY.raising
                  : WORK_ORDER_COPY.raise}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {chosen && chosen.awardLineCount === 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            {WORK_ORDER_COPY.awardHeading}
          </h2>
          <p className="text-sm text-gray-600">{WORK_ORDER_COPY.awardHint}</p>
          <textarea
            value={awardText}
            onChange={(event) => setAwardText(event.target.value)}
            rows={6}
            aria-label={WORK_ORDER_COPY.awardLabel}
            className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
            placeholder={WORK_ORDER_COPY.awardPlaceholder}
          />
          <Button
            type="button"
            disabled={!awardText.trim() || captureAward.isPending}
            onClick={() => {
              setError(null);
              captureAward.mutate();
            }}
          >
            {captureAward.isPending
              ? WORK_ORDER_COPY.awardSaving
              : WORK_ORDER_COPY.awardSave}
          </Button>
        </section>
      )}

      {/* 025 FR-032. A work order's detail and its retention term could be set once and never
          corrected — a typo in either meant living with it, or a second work order beside the
          wrong one. The endpoint has existed since 018 with no caller. */}
      {chosen && (
        <section className="rounded-md border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Correct this work order
          </h3>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const detail = (
                form.elements.namedItem('wo-detail') as HTMLInputElement
              ).value.trim();
              const retention = (
                form.elements.namedItem('wo-retention') as HTMLInputElement
              ).value.trim();
              updateWorkOrder(chosen.id, {
                ...(detail ? { workDetail: detail } : {}),
                // Percent in, fraction out — the same conversion the raise form above makes, and
                // the one the server's bound of 1 is expressed in.
                ...(retention
                  ? { retentionPercent: Number(retention) / 100 }
                  : {}),
              })
                .then(() => {
                  setError(null);
                  void queryClient.invalidateQueries({
                    queryKey: ['workOrders', projectId],
                  });
                })
                .catch((err: unknown) =>
                  setError(err instanceof ApiError ? err.message : String(err)),
                );
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Work detail</span>
              <input
                name="wo-detail"
                defaultValue={chosen.workDetail}
                className="w-80 rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Retention (%)</span>
              <input
                name="wo-retention"
                inputMode="decimal"
                defaultValue={(chosen.retentionPercent * 100).toFixed(2)}
                className="w-28 rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <div className="pb-1">
              <Button type="submit">Save the correction</Button>
            </div>
          </form>
        </section>
      )}

      {/* 025 FR-032. Two endpoints that have existed since 018 with no client at all, so the
          question a subcontractor asks most often — how much are you still holding — could only be
          answered by adding up bills by hand. */}
      {chosen && <RetentionLedger workOrderId={chosen.id} />}

      {chosen && chosen.awardLineCount > 0 && (
        <RaBillSheet
          projectId={projectId}
          workOrderId={chosen.id}
          revising={revising ?? undefined}
          key={`${chosen.id}:${revising?.id ?? 'new'}`}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          {BILLING_COPY.billsHeading}
        </h2>
        {bills.data && bills.data.length === 0 && (
          <p className="text-sm text-gray-600">{BILLING_COPY.billsEmpty}</p>
        )}
        <ul className="space-y-2">
          {(bills.data ?? []).map((bill) => (
            <li
              key={bill.id}
              className="rounded border border-gray-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {bill.billNumber}
                  <span className="ml-2 text-xs text-gray-500">
                    {dateLabel(bill.billingDate)} ·{' '}
                    {BILLING_COPY.statusLabels[bill.status] ?? bill.status}
                  </span>
                </span>
                <span className="tabular-nums text-gray-900">
                  {`${BILLING_COPY.gross} ${rupees(bill.grossAmount)} · ${BILLING_COPY.netPayable} ${rupees(bill.netPayable)}`}
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                {bill.status === 'draft' && (
                  <RowAction
                    type="button"
                    className="min-h-11 justify-center sm:min-h-0"
                    onClick={() => {
                      setError(null);
                      submit.mutate(bill.id);
                    }}
                  >
                    {BILLING_COPY.submit}
                  </RowAction>
                )}
                {bill.workOrderId && (
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setSelected(bill.workOrderId);
                      setRevising(bill);
                    }}
                  >
                    {BILLING_COPY.reviseHeading}
                  </SecondaryButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
