'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type PaymentInstrument,
  type RaBill,
  getBillOutstanding,
  removeBillPayment,
  downloadPaymentAdvice,
} from '@/app/lib/api/billing';
import { saveBlob } from '@/app/lib/download-file';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { SETTLEMENT_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { useCanWrite } from '@/app/lib/write-access';
import { Button } from '@/app/ui/button';
import PaymentAdviceDialog from '@/app/ui/projects/payment-advice-dialog';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import HiddenAmount from '@/app/ui/hidden-amount';
import { confirmDialog } from '@/app/ui/dialogs';
import QueryError from '@/app/ui/query-error';
import { useToast } from '@/app/ui/toast';

/**
 * What has been paid against one bill (028 FR-021).
 *
 * ## No signed-copy section any more (2026-10-14)
 *
 * The countersigned copy used to be filed here, after the bill was already certified and paid
 * against. It is now the **certified copy uploaded at Certify** on the bill package — filed as the
 * RA bill's signed copy, so the acknowledgement it sets is unchanged — and downloaded from the
 * package's lifecycle panel. Two places to file one document is two answers to "which copy is the
 * certified one".
 *
 * ## Why this is a panel of its own rather than part of `RaBillView`
 *
 * `RaBillView` fetches nothing, deliberately: every figure it shows is already on the bill the list
 * carried, so a detail request there would be a second chance for two renderings of one bill to
 * disagree. Payments are **different data**, and they change without the bill
 * changing — so they are read here, beside it, rather than by making that component fetch.
 *
 * ## Outstanding is never computed in this file
 *
 * The server derives it as certified less paid and nothing stores it. Adding the payments up here
 * would be a second derivation, free to disagree with the first — and the first is the one a
 * subcontractor is told. So the figure is rendered exactly as it arrives.
 *
 * ## An uncertified bill shows the reason, not a form
 *
 * The server refuses a payment against a draft, and a form that submits into a refusal is a form
 * that wastes somebody's typing. The sentence says what to do instead: money paid before
 * certification is an advance, recovered through the package's adjustments.
 *
 * ## A cash amount may be hidden, and that is not a bug
 *
 * `instrument` joined the cash surface list with this feature, so a cash payment's amount arrives
 * as `null` with `amountHidden` beside it for a caller without Cash Entry. Rendered as a stated
 * absence through `HiddenAmount` — never as a blank and never as a zero, because a zero is a figure
 * nothing downstream can tell from a real one.
 */
export default function RaBillSettlement({ bill }: { bill: RaBill }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const certified = bill.status === 'approved';

  const outstanding = useQuery({
    queryKey: ['raBillOutstanding', bill.id],
    queryFn: () => getBillOutstanding(bill.id),
    enabled: certified,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['raBillOutstanding', bill.id],
    });
    void queryClient.invalidateQueries({ queryKey: ['raBills'] });
  };

  if (!certified) {
    return (
      <section className="mt-3 border-t border-gray-100 pt-3">
        <h4 className="text-sm font-semibold text-gray-900">
          {SETTLEMENT_COPY.heading}
        </h4>
        <p className="mt-1 text-sm text-gray-600">
          {SETTLEMENT_COPY.notCertified}
        </p>
      </section>
    );
  }

  const position = outstanding.data;

  return (
    <section className="mt-3 space-y-4 border-t border-gray-100 pt-3">
      <h4 className="text-sm font-semibold text-gray-900">
        {SETTLEMENT_COPY.heading}
      </h4>

      {error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* 036 I17 (2026-10-17): this panel used to sit on nothing at all while the read was in flight
          and stay that way if it failed — "loads forever". A placeholder, then the figures or the
          failure with a retry. */}
      {outstanding.isLoading && (
        <div
          role="status"
          aria-label="Loading payments"
          className="grid animate-pulse gap-3 sm:grid-cols-3"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}
      {outstanding.isError && (
        <QueryError
          compact
          error={outstanding.error}
          onRetry={outstanding.refetch}
        />
      )}

      {position && (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {SETTLEMENT_COPY.certified}
            </dt>
            <dd className="tabular-nums">{rupees(position.certifiedAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {SETTLEMENT_COPY.paid}
            </dt>
            <dd className="tabular-nums">{rupees(position.paidAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {SETTLEMENT_COPY.outstanding}
            </dt>
            {/* Exactly as the server derived it. Adding the payments up here would be a second
                derivation of the same figure, and the server's is the one the subcontractor is
                told. */}
            <dd className="font-medium tabular-nums">
              {position.outstandingAmount === 0
                ? SETTLEMENT_COPY.settled
                : rupees(position.outstandingAmount)}
            </dd>
            <dd className="mt-0.5 text-xs text-gray-500">
              {SETTLEMENT_COPY.outstandingHint}
            </dd>
          </div>
        </dl>
      )}

      {position && (
      <Payments
        bill={bill}
        payments={position?.payments ?? []}
        outstanding={position?.outstandingAmount ?? null}
        onError={setError}
        onChanged={refresh}
      />
      )}
    </section>
  );
}

function Payments({
  bill,
  payments,
  outstanding,
  onError,
  onChanged,
}: {
  bill: RaBill;
  payments: {
    id: string;
    paidOn: string;
    amount: number | null;
    amountHidden?: boolean;
    instrument: PaymentInstrument;
    reference: string | null;
    remarks: string | null;
    transactionNo?: string | null;
    mode?: string | null;
    particulars?: string | null;
  }[];
  /** What is left to pay — prefills the advice's amount. */
  outstanding: number | null;
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const [adviceBusy, setAdviceBusy] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canWrite = useCanWrite();
  /** A payment advice read in the page rather than saved (2026-10-14). */
  const { view, viewer } = useFileViewer();

  const advice = async (paymentId: string, format: 'pdf' | 'docx') => {
    setAdviceBusy(`${paymentId}-${format}`);
    try {
      const { blob, filename } = await downloadPaymentAdvice(paymentId, format);
      saveBlob(blob, filename);
    } catch (err) {
      onError(describe(err));
    } finally {
      setAdviceBusy(null);
    }
  };

  const toast = useToast();
  const remove = useMutation({
    mutationFn: (paymentId: string) => removeBillPayment(paymentId),
    onSuccess: () => {
      onError(null);
      toast.success('The payment was removed.');
      onChanged();
    },
    onError: (err: unknown) => onError(describe(err)),
  });

  return (
    <div className="space-y-2">
      {viewer}
      <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {SETTLEMENT_COPY.paymentsHeading}
      </h5>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-600">{SETTLEMENT_COPY.paymentsNone}</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-2 py-1.5"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  {/* A hidden cash amount is a stated absence, never a blank and never a zero. */}
                  {payment.amountHidden ? (
                    <HiddenAmount />
                  ) : (
                    rupees(payment.amount)
                  )}
                </span>
                <span className="text-gray-600">
                  {dateLabel(payment.paidOn)} ·{' '}
                  {payment.mode ??
                    SETTLEMENT_COPY.instrumentLabels[payment.instrument] ??
                    payment.instrument}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                  {payment.particulars ? ` · ${payment.particulars}` : ''}
                </span>
              </span>
              {/* The payment advice for this payment, on the company's own letterhead. */}
              <span className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">Payment advice:</span>
                <SecondaryButton
                  type="button"
                  className="!h-8 px-2 text-xs"
                  onClick={() =>
                    void view({
                      title: `Payment advice — ${dateLabel(payment.paidOn)}`,
                      fileName: 'Payment advice.pdf',
                      load: () => downloadPaymentAdvice(payment.id, 'pdf'),
                    })
                  }
                >
                  View
                </SecondaryButton>
                {(['pdf', 'docx'] as const).map((format) => (
                  <SecondaryButton
                    key={format}
                    type="button"
                    className="!h-8 px-2 text-xs"
                    disabled={adviceBusy !== null}
                    onClick={() => void advice(payment.id, format)}
                  >
                    {adviceBusy === `${payment.id}-${format}`
                      ? '…'
                      : format === 'pdf'
                        ? 'PDF'
                        : 'Word'}
                  </SecondaryButton>
                ))}
              </span>
              <Button
                type="button"
                intent="write"
                loading={remove.isPending && remove.variables === payment.id}
                disabled={remove.isPending}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Remove this payment?',
                      message: SETTLEMENT_COPY.removeConfirm,
                      confirmLabel: 'Remove',
                      tone: 'danger',
                    })
                  ) {
                    remove.mutate(payment.id);
                  }
                }}
              >
                {SETTLEMENT_COPY.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* One way to pay a certified bill, and it always produces the advice: the dialog asks for
          the date, amount, mode and bank reference, reads the vendor's bank details, records the
          payment and downloads the advice (2026-10-13). */}
      {canWrite && (
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Generate payment advice
        </Button>
      )}
      {dialogOpen && (
        <PaymentAdviceDialog
          raBillId={bill.id}
          billNumber={bill.billNumber}
          outstanding={outstanding}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            onError(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function describe(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string };
  };
  // Every refusal here names its own condition and says what to do — an uncertified bill, a
  // payment past what was certified. Passing the server's sentence through is the whole value of
  // having written them.
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'That could not be recorded and the server gave no reason.'
  );
}
