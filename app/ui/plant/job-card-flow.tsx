'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError, type StoredFile } from '@/app/lib/api/client';
import {
  JOB_CARD_FLOW_LABELS,
  JOB_CARD_PAYMENT_MODES,
  JOB_CARD_PAYMENT_MODE_LABELS,
  getJobCardFinalBillFile,
  getJobCardHistory,
  getJobCardPaymentProof,
  getJobCardPayments,
  getJobCardQuotationFile,
  recordJobCardPayment,
  uploadJobCardFinalBill,
  type JobCardEvent,
  type JobCardFlowStatus,
  type JobCardPaymentMode,
} from '@/app/lib/api/plant-hire';
import { getCurrentUser, hasWrite } from '@/app/lib/api/users';
import { useCashRights } from '@/app/lib/cash-entry';
import { MESSAGES } from '@/app/lib/constants';
import { openStoredFile } from '@/app/lib/download-file';
import { dateLabel, dateTimeLabel, todayIso } from '@/app/lib/format';
import { formatRupees } from '@/app/lib/utils';
import { Button, TextButton } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { LoadingText } from '@/app/ui/spinner';
import StatusBadge from '@/app/ui/status-badge';
import { useToast } from '@/app/ui/toast';

/**
 * The job card's workflow on screen (039): its status, its history, the final bill site uploads
 * and the payments Head Office records against it.
 *
 *   Draft → Pending Approval → (Sent for Correction → Pending Approval)* → Approved →
 *   Final Bill Uploaded → Paid
 *
 * The approve / send-back decision itself is taken in the Approvals queue; this screen shows its
 * outcome. The card's own history already records Head Office's decisions, so the spine's
 * decision list is not shown beside it — it would say the same thing twice.
 */

/** The permission Head Office pays with. Spelled once, so a typo is a compile error. */
export const MAINTENANCE_PAY = 'MAINTENANCE_PAY';

/** Whether this user may record payments against a job card's final bill. */
export function useMayPayJobCards(): boolean {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  return hasWrite(user.data, MAINTENANCE_PAY);
}

export function JobCardStatusBadge({
  status,
}: {
  status: JobCardFlowStatus | null | undefined;
}) {
  if (!status) return <span className="text-sm text-gray-500">—</span>;
  return <StatusBadge status={status} label={JOB_CARD_FLOW_LABELS[status]} />;
}

/** Opens one of the card's stored files, reporting a failure rather than doing nothing. */
export function useOpenFile(onError: (message: string) => void) {
  return async (load: () => Promise<StoredFile>, fallbackName: string) => {
    try {
      openStoredFile(await load(), fallbackName);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not open the file.');
    }
  };
}

// ── History ──────────────────────────────────────────────────────────────────

const FIELD_NAMES: Record<string, string> = {
  quotationAmount: 'quotation amount',
  quotationFile: 'quotation file',
  inspections: 'inspection & work',
  parts: 'spare parts',
  signOff: 'sign-off',
  checks: 'handover checks',
};
const fieldName = (key: string) =>
  FIELD_NAMES[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase();

const num = (value: unknown) =>
  typeof value === 'number' ? value : value === undefined ? null : Number(value);

/** One history line in words. */
function describe(event: JobCardEvent): string {
  const d = event.detail ?? {};
  switch (event.kind) {
    case 'created':
      return 'Job card created';
    case 'edited': {
      const fields = Array.isArray(d.fields) ? (d.fields as string[]) : [];
      return fields.length
        ? `Edited — ${fields.map(fieldName).join(', ')}`
        : 'Edited';
    }
    case 'submitted':
      return `Submitted to Head Office${
        num(d.quotationAmount) ? ` · quotation ${formatRupees(num(d.quotationAmount) as number)}` : ''
      }`;
    case 'resubmitted':
      return `Corrected and resubmitted to Head Office${
        num(d.quotationAmount) ? ` · quotation ${formatRupees(num(d.quotationAmount) as number)}` : ''
      }`;
    case 'returned':
      return 'Sent for correction by Head Office';
    case 'approved':
      return 'Approved by Head Office';
    case 'rejected':
      return 'Rejected by Head Office — back to draft';
    case 'bill_uploaded':
      return `${d.replaced ? 'Final bill replaced' : 'Final bill uploaded'}${
        d.billNumber ? ` · ${String(d.billNumber)}` : ''
      }${num(d.amount) ? ` · ${formatRupees(num(d.amount) as number)}` : ''}`;
    case 'payment':
      return `Payment of ${formatRupees(num(d.amount) ?? 0)}${
        d.mode
          ? ` by ${JOB_CARD_PAYMENT_MODE_LABELS[d.mode as JobCardPaymentMode] ?? String(d.mode)}`
          : ''
      }${d.referenceNumber ? ` · ref ${String(d.referenceNumber)}` : ''}`;
    case 'paid':
      return 'Paid in full';
    default:
      return event.kind;
  }
}

/** Who did what to the card, and when — oldest first, as the card went. */
export function JobCardHistory({ jobId }: { jobId: string }) {
  const history = useQuery({
    queryKey: ['plant', 'job-card', jobId, 'history'],
    queryFn: () => getJobCardHistory(jobId),
  });
  if (history.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (history.isError) return <FormError message="Could not load the history." />;
  if (history.data.length === 0) {
    return <p className="text-sm text-gray-500">Nothing recorded yet.</p>;
  }
  return (
    <ol className="space-y-3 border-l border-gray-200 pl-4">
      {history.data.map((event) => (
        <li key={event.id} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-gray-900">{describe(event)}</p>
            {event.toStatus && event.toStatus !== event.fromStatus && (
              <JobCardStatusBadge status={event.toStatus} />
            )}
          </div>
          {event.remarks && (
            <p className="mt-0.5 whitespace-pre-line text-gray-700">“{event.remarks}”</p>
          )}
          <p className="text-xs text-gray-500">
            {dateTimeLabel(event.at)}
            {event.actorName ? ` · ${event.actorName}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function JobCardHistoryModal({
  jobId,
  jobCardNo,
  onClose,
}: {
  jobId: string;
  jobCardNo: string | null | undefined;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Job card ${jobCardNo ?? ''} — history`}
      onClose={onClose}
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <JobCardHistory jobId={jobId} />
    </Modal>
  );
}

// ── Final bill ───────────────────────────────────────────────────────────────

/** Site uploads the workshop's final bill once Head Office has approved the card. */
export function FinalBillModal({
  jobId,
  jobCardNo,
  onClose,
}: {
  jobId: string;
  jobCardNo: string | null | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Attach the bill copy.');
      return uploadJobCardFinalBill(jobId, {
        billNumber: billNumber.trim(),
        billDate,
        amount: Number(amount),
        file: file.base64,
        fileName: file.fileName,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success('Final bill uploaded. Head Office can now record payment.');
      onClose();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title={`Upload final bill — ${jobCardNo ?? 'job card'}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="jc-final-bill" disabled={save.isPending}>
            {save.isPending ? 'Uploading…' : 'Upload bill'}
          </Button>
        </>
      }
    >
      <form
        id="jc-final-bill"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="jc-bill-number"
            label="Bill number"
            required
            maxLength={60}
            value={billNumber}
            onChange={(event) => setBillNumber(event.target.value)}
          />
          <TextField
            id="jc-bill-date"
            label="Bill date"
            type="date"
            required
            max={todayIso()}
            value={billDate}
            onChange={(event) => setBillDate(event.target.value)}
          />
          <TextField
            id="jc-bill-amount"
            label="Amount (₹)"
            type="number"
            inputMode="decimal"
            required
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <FileUpload label="Bill copy" hint="PDF or photo of the workshop’s bill." onSelect={setFile} />
      </form>
    </Modal>
  );
}

// ── Payment ──────────────────────────────────────────────────────────────────

/**
 * The bill's payments, the paid total and the balance — and, for Head Office (`MAINTENANCE_PAY`)
 * while the bill is unpaid, the form to record one more. Cash is offered only to a user who may
 * enter cash, and never while the company hides cash (038).
 */
export function JobCardPaymentModal({
  jobId,
  jobCardNo,
  onClose,
}: {
  jobId: string;
  jobCardNo: string | null | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mayPay = useMayPayJobCards();
  const cash = useCashRights();
  const modes = JOB_CARD_PAYMENT_MODES.filter((m) => m !== 'cash' || cash.mayEnterCash);

  const data = useQuery({
    queryKey: ['plant', 'job-card', jobId, 'payments'],
    queryFn: () => getJobCardPayments(jobId),
  });
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [mode, setMode] = useState<JobCardPaymentMode>('bank_transfer');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proof, setProof] = useState<PreparedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openFile = useOpenFile(setError);

  const record = useMutation({
    mutationFn: () =>
      recordJobCardPayment(jobId, {
        amount: Number(amount),
        paidOn,
        mode,
        referenceNumber: reference.trim() || undefined,
        remarks: remarks.trim() || undefined,
        proofFile: proof?.base64,
        proofFileName: proof?.fileName,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success('Payment recorded.');
      setAmount('');
      setReference('');
      setRemarks('');
      setProof(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  const payable = data.data?.status === 'bill_uploaded' && mayPay;

  return (
    <Modal
      title={`Payments — ${jobCardNo ?? 'job card'}`}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Close
          </SecondaryButton>
          {payable && (
            // Reached only through the payer's own action; MAINTENANCE_PAY gates it, not the
            // page's MAINTENANCE.
            <Button
              intent="read"
              type="submit"
              form="jc-payment"
              disabled={record.isPending}
            >
              {record.isPending ? 'Recording…' : 'Record payment'}
            </Button>
          )}
        </>
      }
    >
      {data.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : data.isError ? (
        <FormError message={MESSAGES.plantLoadFailed} />
      ) : (
        <div className="flex flex-col gap-5">
          <FormError message={error} />
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Bill</dt>
              <dd className="font-medium text-gray-900">
                {data.data.billAmount === null ? '—' : formatRupees(data.data.billAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Paid</dt>
              <dd className="font-medium text-gray-900">{formatRupees(data.data.paidTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Balance</dt>
              <dd className="font-medium text-gray-900">
                {data.data.balance === null ? '—' : formatRupees(data.data.balance)}
              </dd>
            </div>
          </dl>

          {data.data.payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payment recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {data.data.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatRupees(p.amount)} · {JOB_CARD_PAYMENT_MODE_LABELS[p.mode]}
                      {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      Paid {dateLabel(p.paidOn)}
                      {p.recordedByName ? ` · recorded by ${p.recordedByName}` : ''}
                    </p>
                    {p.remarks && <p className="mt-0.5 text-gray-700">{p.remarks}</p>}
                  </div>
                  {p.hasProof && (
                    <TextButton
                      type="button"
                      onClick={() =>
                        void openFile(
                          () => getJobCardPaymentProof(jobId, p.id),
                          p.proofFileName ?? 'payment-proof',
                        )
                      }
                    >
                      Proof
                    </TextButton>
                  )}
                </li>
              ))}
            </ul>
          )}

          {payable && (
            <form
              id="jc-payment"
              className="flex flex-col gap-4 border-t border-gray-200 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                record.mutate();
              }}
            >
              <h3 className="text-sm font-semibold text-gray-900">Record a payment</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  id="jc-pay-amount"
                  label="Amount (₹)"
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.01"
                  step="0.01"
                  max={data.data.balance ?? undefined}
                  hint={
                    data.data.balance !== null
                      ? `Up to ${formatRupees(data.data.balance)}`
                      : undefined
                  }
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <TextField
                  id="jc-pay-date"
                  label="Paid on"
                  type="date"
                  required
                  max={todayIso()}
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                />
                <SelectField
                  id="jc-pay-mode"
                  label="Mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as JobCardPaymentMode)}
                >
                  {modes.map((m) => (
                    <option key={m} value={m}>
                      {JOB_CARD_PAYMENT_MODE_LABELS[m]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="jc-pay-ref"
                  label="Reference (UTR / cheque no.)"
                  maxLength={100}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
                <TextField
                  id="jc-pay-remarks"
                  label="Remarks"
                  maxLength={500}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </div>
              <FileUpload label="Payment proof (optional)" onSelect={setProof} />
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── The card's workflow strip, inside the job card modal ─────────────────────

/** Opens the quotation or the final bill. */
export function quotationLoader(jobId: string) {
  return () => getJobCardQuotationFile(jobId);
}
export function finalBillLoader(jobId: string) {
  return () => getJobCardFinalBillFile(jobId);
}
