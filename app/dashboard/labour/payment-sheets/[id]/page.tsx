'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import {
  approvePaymentSheet,
  blobToBase64,
  deletePaymentSheet,
  disburseLine,
  downloadPaymentSheetXlsx,
  getPaymentSheet,
  regeneratePaymentSheet,
  reopenPaymentSheet,
  reverseLine,
  type PaymentSheet,
  type PaymentSheetLine,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { useCashRights } from '@/app/lib/cash-entry';
import {
  CASH_DENOMINATIONS,
  labourLabel,
  MESSAGES,
  RATE_SOURCE_LABELS,
  ROUTES,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import CameraCapture from '@/app/ui/my/camera-capture';
import QueryError from '@/app/ui/query-error';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';
import { useToast } from '@/app/ui/toast';
import PageHeader from '@/app/ui/page-header';

interface Breakup {
  notes: Record<string, number>;
  totalNotes: number;
  residuals: { workerId: string; residual: number }[];
}

/** A line's deductions, or null when any of them arrived masked. */
function deductionTotal(l: PaymentSheetLine): number | null {
  // A nulled deduction is a masked one, not a zero: summing it as zero would understate the
  // column. Since 038 a cash line does not arrive at all while the company hides cash, so this is
  // only the backstop for the old masking, and reads as no figure.
  if (l.deductions.some((d) => d.amount === null)) return null;
  return l.deductions.reduce((sum, d) => sum + (d.amount ?? 0), 0);
}

const isCarry = (l: PaymentSheetLine) => l.kind === 'carry_forward';

// Keys match the line's own fields, so each column sorts by the raw figure rather than its text.
// 036 O8: the names come with the sheet now. The page used to fetch the site's first 200 workers to
// name the lines, so the 201st showed as a raw id.
const lineColumns: Column<PaymentSheetLine>[] = [
  {
    key: 'workerId',
    header: 'Labour',
    sortValue: (l) => l.labourCode ?? l.workerId,
    render: (l) => (
      <>
        {l.workerName ?? 'Unknown worker'}
        {l.labourCode && (
          <span className="ml-1 text-xs text-gray-500">{l.labourCode}</span>
        )}
        {/* 052: the contractor the line was priced under. */}
        {l.contractorName && (
          <span className="mt-0.5 block text-xs text-gray-600">
            {l.contractorName}
          </span>
        )}
        {/* 036 O4: a short payment on an earlier sheet, paid here as a line of its own. */}
        {isCarry(l) && (
          <span className="mt-0.5 block text-xs text-amber-800">
            Balance carried forward
          </span>
        )}
      </>
    ),
  },
  {
    key: 'daysWorked',
    header: 'Days',
    numeric: true,
    render: (l) => (isCarry(l) ? 0 : l.daysWorked),
  },
  {
    key: 'overtimeHours',
    header: 'OT',
    numeric: true,
    render: (l) => (isCarry(l) ? '—' : l.overtimeHours),
  },
  {
    key: 'resolvedRate',
    header: 'Rate',
    numeric: true,
    render: (l) =>
      isCarry(l) ? (
        '—'
      ) : (
        <>
          {rupees(l.resolvedRate)}
          <span className="ml-1 text-xs text-gray-500">
            {RATE_SOURCE_LABELS[l.rateSource] ?? l.rateSource}
          </span>
        </>
      ),
  },
  {
    key: 'grossWage',
    header: 'Gross',
    numeric: true,
    render: (l) => rupees(l.grossWage),
  },
  {
    key: 'deductions',
    header: 'Deductions',
    numeric: true,
    sortValue: deductionTotal,
    render: (l) => {
      const total = deductionTotal(l);
      return rupees(total);
    },
  },
  {
    key: 'netPayable',
    header: 'Net',
    numeric: true,
    render: (l) => rupees(l.netPayable),
  },
  {
    key: 'status',
    header: 'Status',
    render: (l) => <StatusBadge status={l.status} />,
  },
];

/**
 * Where to go to clear a refusal that names a fix elsewhere (036: reopen and regenerate now work
 * the sheet out again, so they can be refused for the same reasons generating is). The server's
 * sentence already says what is wrong; this is the shortcut to fixing it.
 */
function fixLinkFor(e: unknown): { href: string; label: string } | null {
  if (!(e instanceof ApiError)) return null;
  if (e.code === 'LABOUR_UNRESOLVED_PUNCHES') {
    return { href: ROUTES.labourMusterAttendance, label: 'Open Muster attendance' };
  }
  if (e.code === 'LABOUR_MUSTER_AWAITING_APPROVAL') {
    const musterId = e.details?.musterId;
    return typeof musterId === 'string'
      ? { href: ROUTES.labourMuster(musterId), label: 'Open the muster' }
      : { href: ROUTES.labourMusters, label: 'Open Musters' };
  }
  if (e.code === 'LABOUR_SITE_RATE_MISSING') {
    return { href: ROUTES.labourSiteRates, label: 'Open Site rates' };
  }
  if (e.code === 'LABOUR_GENDER_MISSING') {
    return { href: ROUTES.labourWorkers, label: 'Open Workers' };
  }
  return null;
}

export default function PaymentSheetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  // The refusal stays on screen (not a toast): the reopen and regenerate ones name what to fix.
  const [failure, setFailure] = useState<unknown>(null);
  const [disbursing, setDisbursing] = useState<PaymentSheetLine | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const sheet = useQuery({
    queryKey: ['payment-sheet', id],
    queryFn: () => getPaymentSheet(id),
  });

  const download = useMutation({
    mutationFn: () => downloadPaymentSheetXlsx(id),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (e) => toast.error(errorMessage(e, 'Could not download the sheet.')),
  });

  const canApprove = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;
  // 019 FR-017a, FR-017d. Two separate rights — and since 038 both are false while the company
  // hides cash, when neither the breakup nor a cash disbursement exists — see `app/lib/cash-entry.ts`.
  const { mayEnterCash, maySeeCashBreakup, cashHidden } = useCashRights();
  // 036 O9: the list shows status and totals too, so it is refreshed with the sheet — it used to
  // keep showing "Draft" after an approval until a reload.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payment-sheet', id] }),
      queryClient.invalidateQueries({ queryKey: ['payment-sheets'] }),
    ]);
  const succeeded = (message: string) => {
    setFailure(null);
    toast.success(message);
    return invalidate();
  };

  const approve = useMutation({
    mutationFn: () => approvePaymentSheet(id),
    onSuccess: () => succeeded('Sheet approved.'),
    onError: setFailure,
  });
  const reopen = useMutation({
    mutationFn: (reason: string) => reopenPaymentSheet(id, reason),
    onSuccess: () => succeeded('Sheet reopened and worked out again.'),
    onError: setFailure,
  });
  const regenerate = useMutation({
    mutationFn: () => regeneratePaymentSheet(id),
    onSuccess: () => succeeded('Sheet worked out again from the attendance.'),
    onError: setFailure,
  });
  const remove = useMutation({
    mutationFn: (reason: string) => deletePaymentSheet(id, reason || undefined),
    onSuccess: async () => {
      toast.success('Payment sheet deleted.');
      await queryClient.invalidateQueries({ queryKey: ['payment-sheets'] });
      router.push(ROUTES.labourPaymentSheets);
    },
    onError: setFailure,
  });
  const reverse = useMutation({
    mutationFn: ({ lineId, reason }: { lineId: string; reason: string }) =>
      reverseLine(lineId, reason),
    onMutate: ({ lineId }) => setReversingId(lineId),
    onSuccess: () => succeeded('Payment reversed.'),
    onError: setFailure,
    onSettled: () => setReversingId(null),
  });
  const busy =
    approve.isPending ||
    reopen.isPending ||
    regenerate.isPending ||
    remove.isPending;

  if (sheet.isPending) {
    return <ListSkeleton headers={['Labour', 'Days', 'Gross', 'Net', 'Status']} />;
  }
  if (sheet.isError || !sheet.data) {
    return (
      <QueryError
        error={sheet.error}
        onRetry={sheet.refetch}
        fallback="Could not load this sheet."
      />
    );
  }

  const s: PaymentSheet = sheet.data;
  const anyDisbursed = s.lines.some((l) => l.status === 'disbursed');
  const breakup = s.denominationBreakup as Breakup | null;
  const workerLabel = (workerId: string) => {
    const line = s.lines.find((l) => l.workerId === workerId);
    return line?.workerName ?? line?.labourCode ?? 'Unknown worker';
  };
  const fix = fixLinkFor(failure);

  const askApprove = async () => {
    const ok = await confirmDialog({
      title: 'Approve this sheet?',
      message: `Every figure is frozen at ${rupees(s.netTotal)} net, and payments can then be recorded against it.`,
      confirmLabel: 'Approve',
    });
    if (ok) approve.mutate();
  };
  const askReopen = async () => {
    const reason = await promptDialog({
      title: 'Reopen this sheet?',
      message:
        'It goes back to draft and is worked out again from the attendance, rates and advances as they stand now.',
      label: 'Reason',
      required: true,
      multiline: true,
      confirmLabel: 'Reopen',
    });
    if (reason?.trim()) reopen.mutate(reason.trim());
  };
  const askRegenerate = async () => {
    const ok = await confirmDialog({
      title: 'Work this sheet out again?',
      message:
        'Every line is recalculated from the attendance, rates, advances and earlier shortfalls as they stand now.',
      confirmLabel: 'Regenerate',
    });
    if (ok) regenerate.mutate();
  };
  const askDelete = async () => {
    const reason = await promptDialog({
      title: 'Delete this draft sheet?',
      message:
        'Its days can be corrected again and the advance instalments it set aside are freed. Generate a new sheet for these dates afterwards.',
      label: 'Reason (optional)',
      multiline: true,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (reason !== null) remove.mutate(reason.trim());
  };
  const askReverse = async (line: PaymentSheetLine) => {
    const reason = await promptDialog({
      title: `Reverse the payment to ${line.workerName ?? 'this worker'}?`,
      message: `The ${rupees(line.paidAmount ?? line.netPayable)} payment is undone, the line goes back to pending, and any advance it recovered is given back.`,
      label: 'Reason',
      required: true,
      multiline: true,
      confirmLabel: 'Reverse',
      tone: 'danger',
    });
    if (reason?.trim()) reverse.mutate({ lineId: line.id, reason: reason.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader
          title={
            <>
              Payment Sheet — {dateLabel(s.periodFrom)} → {dateLabel(s.periodTo)}
            </>
          }
          description={
            s.siteName ?? <>{labourLabel(s.engagementType)} engagement</>
          }
          breadcrumbs={[{ label: 'Payment sheets', href: ROUTES.labourPaymentSheets }]}
        />
        <StatusBadge status={s.status} label={labourLabel(s.status)} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Gross" value={rupees(s.grossTotal)} />
        <Summary label="Deductions" value={rupees(s.deductionTotal)} />
        <Summary label="Net" value={rupees(s.netTotal)} />
        <Summary
          label="Disbursed / Pending"
          value={`${s.summary.disbursedCount} / ${s.summary.pendingCount}`}
        />
        {s.summary.carriedForwardAmount > 0 && (
          <Summary
            label="Carried forward from earlier sheets"
            value={rupees(s.summary.carriedForwardAmount)}
          />
        )}
      </div>

      {failure !== null && (
        <div className="space-y-2">
          <FormError message={errorMessage(failure)} />
          {fix && (
            <Link
              href={fix.href}
              className="inline-block text-sm font-medium text-brand-700 underline"
            >
              {fix.label}
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <SecondaryButton
          onClick={() => download.mutate()}
          loading={download.isPending}
        >
          Excel
        </SecondaryButton>
        {s.status === 'draft' && canApprove && (
          <Button onClick={askApprove} loading={approve.isPending} disabled={busy}>
            Approve
          </Button>
        )}
        {s.status === 'draft' && (
          <>
            <SecondaryButton
              onClick={askRegenerate}
              loading={regenerate.isPending}
              disabled={busy}
            >
              Regenerate
            </SecondaryButton>
            <SecondaryButton
              onClick={askDelete}
              loading={remove.isPending}
              disabled={busy}
            >
              Delete
            </SecondaryButton>
          </>
        )}
        {s.status === 'approved' && canApprove && (
          <SecondaryButton
            onClick={askReopen}
            loading={reopen.isPending}
            disabled={anyDisbursed || busy}
            title={
              anyDisbursed
                ? 'A disbursement exists, so this sheet cannot be reopened.'
                : undefined
            }
          >
            Reopen
          </SecondaryButton>
        )}
      </div>

      {/* The shared table: sortable by any column (2026-10-15). */}
      <DataTable<PaymentSheetLine>
        caption="Payment sheet lines"
        rows={s.lines}
        rowKey={(l) => l.id}
        columns={lineColumns}
        emptyMessage="No workers on this sheet."
        actions={(l) => (
          <>
            {(s.status === 'approved' || s.status === 'partially_disbursed') &&
              l.status === 'pending' && (
                <RowAction onClick={() => setDisbursing(l)}>Disburse</RowAction>
              )}
            {l.status === 'disbursed' && canApprove && (
              <RowAction
                onClick={() => void askReverse(l)}
                loading={reversingId === l.id}
                disabled={reversingId !== null}
              >
                Reverse
              </RowAction>
            )}
          </>
        )}
      />

      {s.engagementType === 'direct' && breakup && maySeeCashBreakup && (
        <div className="rounded-lg border border-gray-100 p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Cash Denomination Breakup
          </h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {CASH_DENOMINATIONS.filter((d) => breakup.notes[String(d)]).map(
              (d) => (
                <span key={d} className="rounded-md bg-gray-50 px-3 py-1.5">
                  ₹{d} × {breakup.notes[String(d)]}
                </span>
              ),
            )}
          </div>
          {breakup.residuals.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Per-worker residual carried forward:{' '}
              {breakup.residuals
                .map((r) => `${workerLabel(r.workerId)} ${rupees(r.residual)}`)
                .join(', ')}
            </p>
          )}
        </div>
      )}

      {s.engagementType === 'direct' && breakup && !maySeeCashBreakup && !cashHidden && (
        // FR-014. The alternative is a sheet that simply ends after the table, which reads as a
        // screen that failed to finish loading. Naming the permission is what lets the reader
        // decide between reporting a bug and asking for access.
        <p className="rounded-lg border border-gray-100 p-4 text-xs text-gray-500">
          {MESSAGES.cashBreakupHidden}
        </p>
      )}

      {disbursing && (
        <DisburseModal
          mayEnterCash={mayEnterCash}
          cashHidden={cashHidden}
          line={disbursing}
          onClose={() => setDisbursing(null)}
          onSaved={() => {
            setDisbursing(null);
            void succeeded('Payment recorded.');
          }}
        />
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function DisburseModal({
  line,
  mayEnterCash,
  cashHidden,
  onClose,
  onSaved,
}: {
  line: PaymentSheetLine;
  mayEnterCash: boolean;
  cashHidden: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Defaults to cash for a holder, because that is what a site cashier opening this is almost
  // always doing — and to bank for everyone else, because a mode they cannot submit must not be
  // the one the form arrives holding.
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>(
    mayEnterCash ? 'cash' : 'bank',
  );
  const [paidOn, setPaidOn] = useState(todayIso);
  const [paidAmount, setPaidAmount] = useState(String(line.netPayable));
  const [shortPaymentReason, setShortPaymentReason] = useState('');
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      disburseLine(line.id, {
        paymentMode,
        paidOn,
        paidAmount: Number(paidAmount),
        acknowledgement: acknowledgement ?? undefined,
        shortPaymentReason: short ? shortPaymentReason.trim() : undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e, 'Could not record the payment.')),
  });

  // 036 O9 / O4: more than the net is refused by the server (`LABOUR_PAID_ABOVE_NET`), and nothing
  // paid is not a payment — said here, beside the field, before the request.
  const amount = Number(paidAmount);
  const amountError =
    paidAmount === ''
      ? undefined
      : !Number.isFinite(amount) || amount <= 0
      ? 'Enter an amount above zero.'
      : amount > line.netPayable
      ? `At most the net payable, ${rupees(line.netPayable)}.`
      : undefined;
  const short = !amountError && paidAmount !== '' && amount < line.netPayable;
  const futureDate = paidOn > todayIso();
  const needsAck = paymentMode === 'cash' && !acknowledgement;
  const valid =
    !!paidOn &&
    !futureDate &&
    paidAmount !== '' &&
    !amountError &&
    !needsAck &&
    (!short || shortPaymentReason.trim() !== '');

  return (
    <Modal
      title="Disburse Payment"
      onClose={onClose}
      pending={mutation.isPending}
      isDirty={acknowledgement !== null || paidAmount !== String(line.netPayable)}
      // O15: the buttons go straight into the footer, which stacks them full width on a phone.
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
            loading={mutation.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          {line.workerName ?? 'Unknown worker'}
          {line.labourCode && (
            <span className="ml-1 text-gray-500">{line.labourCode}</span>
          )}
          {isCarry(line) && (
            <span className="ml-1 text-amber-800">· Balance carried forward</span>
          )}
        </p>
        <FormError message={error} />
        <SelectField
          id="dis-mode"
          label="Payment mode *"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as 'cash' | 'bank')}
        >
          {mayEnterCash && <option value="cash">Cash</option>}
          <option value="bank">Bank</option>
        </SelectField>
        {!mayEnterCash && !cashHidden && (
          <p className="text-xs text-gray-500">
            {MESSAGES.cashEntryUnavailable}
          </p>
        )}
        <TextField
          id="dis-date"
          label="Paid on *"
          type="date"
          required
          max={todayIso()}
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          error={futureDate ? 'A payment cannot be dated in the future.' : undefined}
        />
        <TextField
          id="dis-amount"
          label="Paid amount (₹) *"
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          max={line.netPayable}
          step="0.01"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          error={amountError}
          hint={`Net payable is ${rupees(line.netPayable)}.`}
        />
        {short && (
          <TextField
            id="dis-short"
            label="Short payment reason *"
            required
            value={shortPaymentReason}
            onChange={(e) => setShortPaymentReason(e.target.value)}
            hint={`The ${rupees(line.netPayable - amount)} unpaid goes onto this worker's next payment sheet.`}
          />
        )}
        {paymentMode === 'cash' && (
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">
              Acknowledgement (thumb impression / signature) *
            </p>
            {acknowledgement ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-700">Captured ✓</span>
                <SecondaryButton onClick={() => setAcknowledgement(null)}>
                  Retake
                </SecondaryButton>
              </div>
            ) : (
              <CameraCapture
                captureLabel="Capture acknowledgement"
                onCapture={async (blob) => {
                  setAcknowledgement(await blobToBase64(blob));
                }}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
