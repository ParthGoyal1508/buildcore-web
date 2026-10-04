'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  certifyClientBill,
  getClientBills,
  submitClientBill,
  type ClientBill,
} from '@/app/lib/api/billing';
import { BILLING_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import ResponsiveList, {
  type Column,
} from '@/app/ui/settings/responsive-list';
import { FormError, RowAction, TextField } from '@/app/ui/settings/form-fields';

/**
 * The bills already raised on a project (018 FR-005, FR-006).
 *
 * `ResponsiveList` here and deliberately not in the sheet (T015): a billing history is a
 * settings-sized list of read-only rows, which is exactly what it is for. The sheet is 300 editable
 * inputs, which is exactly what it is not.
 *
 * ## Rendered at the rates it was billed at (FR-006)
 *
 * Every figure on a row comes from the bill, never from the BOQ. A rate revised after a bill was
 * sent must not restate it — the bill is a document somebody received, and re-pricing it from a live
 * rate table makes every historical bill change shape each time a rate is corrected. The note under
 * the list says so, because a reader comparing a bill to today's BOQ will otherwise wonder which is
 * wrong.
 *
 * ## A short certification is stated, not left to be noticed
 *
 * FR-005 keeps both the billed and the certified amount. The variance between them is the thing a
 * project manager chases, and it must not be reachable only by noticing that two columns differ.
 */
export default function ClientBillsList({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [certifying, setCertifying] = useState<string | null>(null);
  const [certifiedAmount, setCertifiedAmount] = useState('');

  const bills = useQuery({
    queryKey: ['clientBills', projectId],
    queryFn: () => getClientBills(projectId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['clientBills', projectId] });
    // The BOQ's cumulative column moves when a bill leaves draft, so the sheet above has to be
    // told. Invalidating rather than patching: the server decides what is now billed to date.
    void queryClient.invalidateQueries({ queryKey: ['billableBoq', projectId] });
  };

  const submit = useMutation({
    mutationFn: (id: string) => submitClientBill(id),
    onSuccess: refresh,
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : BILLING_COPY.submitFailed,
      ),
  });

  const certify = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      certifyClientBill(id, amount),
    onSuccess: () => {
      setCertifying(null);
      setCertifiedAmount('');
      refresh();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : BILLING_COPY.submitFailed),
  });

  const columns: Column<ClientBill>[] = [
    {
      key: 'billNumber',
      header: BILLING_COPY.billNumberLabel,
      render: (bill) => (
        <div>
          <div className="font-medium text-gray-900">{bill.billNumber}</div>
          <div className="text-xs text-gray-500">
            {dateLabel(bill.billingDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: BILLING_COPY.statusHeader,
      render: (bill) => (
        <span className="text-sm text-gray-700">
          {BILLING_COPY.statusLabels[bill.status] ?? bill.status}
        </span>
      ),
    },
    {
      key: 'gross',
      header: BILLING_COPY.gross,
      render: (bill) => (
        <span className="tabular-nums">{rupees(bill.grossAmount)}</span>
      ),
    },
    {
      key: 'retention',
      header: BILLING_COPY.retention,
      render: (bill) => (
        <span className="tabular-nums">{rupees(bill.retentionAmount)}</span>
      ),
    },
    {
      key: 'net',
      header: BILLING_COPY.net,
      render: (bill) => (
        <span className="font-medium tabular-nums">
          {rupees(bill.netAmount)}
        </span>
      ),
    },
    {
      key: 'certified',
      header: BILLING_COPY.certified,
      render: (bill) =>
        bill.certifiedAmount === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <div>
            <div className="tabular-nums text-gray-900">
              {rupees(bill.certifiedAmount)}
            </div>
            {bill.certificationVariance !== null &&
              bill.certificationVariance !== 0 && (
                <div className="mt-0.5 text-xs text-amber-900">
                  {BILLING_COPY.certifiedShort(
                    rupees(bill.certificationVariance),
                  )}
                </div>
              )}
          </div>
        ),
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900">
        {BILLING_COPY.billsHeading}
      </h2>
      <FormError message={error} />
      <ResponsiveList
        columns={columns}
        rows={bills.data ?? []}
        rowKey={(bill) => bill.id}
        isLoading={bills.isLoading}
        error={bills.isError ? BILLING_COPY.boqLoadFailed : null}
        emptyMessage={BILLING_COPY.billsEmpty}
        actions={(bill) => (
          <div className="flex flex-col gap-2 sm:flex-row">
            {bill.status === 'draft' && (
              <RowAction
                type="button"
                className="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
                disabled={submit.isPending}
                onClick={() => {
                  setError(null);
                  submit.mutate(bill.id);
                }}
              >
                {submit.isPending
                  ? BILLING_COPY.submitting
                  : BILLING_COPY.submit}
              </RowAction>
            )}
            {bill.status !== 'draft' && bill.certifiedAmount === null && (
              <RowAction
                type="button"
                className="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"
                onClick={() => {
                  setCertifying(bill.id);
                  // Pre-filled with the billed figure, which is the common case: the client
                  // certifies what was billed. A blank field would make the common case the most
                  // typing.
                  setCertifiedAmount(String(bill.grossAmount));
                }}
              >
                {BILLING_COPY.certifyOpen}
              </RowAction>
            )}
          </div>
        )}
        detail={(bill) =>
          certifying === bill.id ? (
            <div className="space-y-2">
              <TextField
                id={`certified-${bill.id}`}
                type="number"
                step="0.01"
                min="0"
                label={BILLING_COPY.certifyLabel}
                hint={BILLING_COPY.certifyHint}
                value={certifiedAmount}
                onChange={(event) => setCertifiedAmount(event.target.value)}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <RowAction
                  type="button"
                  intent="read"
                  onClick={() => setCertifying(null)}
                >
                  {BILLING_COPY.cancel}
                </RowAction>
                <RowAction
                  type="button"
                  disabled={certify.isPending || certifiedAmount === ''}
                  onClick={() => {
                    setError(null);
                    certify.mutate({
                      id: bill.id,
                      amount: Number(certifiedAmount),
                    });
                  }}
                >
                  {certify.isPending
                    ? BILLING_COPY.certifySaving
                    : BILLING_COPY.certifySave}
                </RowAction>
              </div>
            </div>
          ) : null
        }
      />
      <p className="text-xs text-gray-500">
        {BILLING_COPY.historicalRatesNote}
      </p>
    </section>
  );
}
