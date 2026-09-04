'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  approvePaymentSheet,
  blobToBase64,
  disburseLine,
  getPaymentSheet,
  reopenPaymentSheet,
  reverseLine,
  type PaymentSheet,
  type PaymentSheetLine,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  CASH_DENOMINATIONS,
  labourLabel,
  RATE_SOURCE_LABELS,
} from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import CameraCapture from '@/app/ui/my/camera-capture';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import StatusBadge from '@/app/ui/status-badge';

interface Breakup {
  notes: Record<string, number>;
  totalNotes: number;
  residuals: { workerId: string; residual: number }[];
}

export default function PaymentSheetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [disbursing, setDisbursing] = useState<PaymentSheetLine | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const sheet = useQuery({
    queryKey: ['payment-sheet', id],
    queryFn: () => getPaymentSheet(id),
  });

  const canApprove = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['payment-sheet', id] });

  const approve = useMutation({
    mutationFn: () => approvePaymentSheet(id),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not approve.'),
  });
  const reopen = useMutation({
    mutationFn: () => reopenPaymentSheet(id, 'Reopened for correction'),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not reopen.'),
  });
  const reverse = useMutation({
    mutationFn: (lineId: string) => reverseLine(lineId, 'Reversed'),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not reverse.'),
  });

  if (sheet.isPending) {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }
  if (sheet.isError || !sheet.data) {
    return <p className="p-4 text-sm text-red-600">Could not load this sheet.</p>;
  }

  const s: PaymentSheet = sheet.data;
  const anyDisbursed = s.lines.some((l) => l.status === 'disbursed');
  const breakup = s.denominationBreakup as Breakup | null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Payment Sheet — {s.periodFrom} → {s.periodTo}
          </h1>
          <p className="text-sm text-gray-500">
            {labourLabel(s.engagementType)} engagement
          </p>
        </div>
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
      </div>

      <FormError message={error} />

      <div className="flex flex-wrap gap-2">
        {s.status === 'draft' && canApprove && (
          <Button onClick={() => approve.mutate()}>Approve</Button>
        )}
        {s.status === 'approved' && canApprove && (
          <SecondaryButton
            onClick={() => reopen.mutate()}
            disabled={anyDisbursed}
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

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Worker</th>
              <th className="px-3 py-2">Days</th>
              <th className="px-3 py-2">OT</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Deductions</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {s.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">{l.workerId}</td>
                <td className="px-3 py-2">{l.daysWorked}</td>
                <td className="px-3 py-2">{l.overtimeHours}</td>
                <td className="px-3 py-2">
                  {rupees(l.resolvedRate)}
                  <span className="ml-1 text-xs text-gray-400">
                    {RATE_SOURCE_LABELS[l.rateSource] ?? l.rateSource}
                  </span>
                </td>
                <td className="px-3 py-2">{rupees(l.grossWage)}</td>
                <td className="px-3 py-2">
                  {rupees(
                    l.deductions.reduce((sum, d) => sum + d.amount, 0),
                  )}
                </td>
                <td className="px-3 py-2">{rupees(l.netPayable)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-3 py-2">
                  {(s.status === 'approved' ||
                    s.status === 'partially_disbursed') &&
                    l.status === 'pending' && (
                      <RowAction onClick={() => setDisbursing(l)}>
                        Disburse
                      </RowAction>
                    )}
                  {l.status === 'disbursed' && canApprove && (
                    <RowAction onClick={() => reverse.mutate(l.id)}>
                      Reverse
                    </RowAction>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {s.engagementType === 'direct' && breakup && (
        <div className="rounded-lg border border-gray-100 p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Cash Denomination Breakup
          </h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {CASH_DENOMINATIONS.filter((d) => breakup.notes[String(d)]).map(
              (d) => (
                <span
                  key={d}
                  className="rounded-md bg-gray-50 px-3 py-1.5"
                >
                  ₹{d} × {breakup.notes[String(d)]}
                </span>
              ),
            )}
          </div>
          {breakup.residuals.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Per-worker residual carried forward:{' '}
              {breakup.residuals
                .map((r) => `${r.workerId} ₹${r.residual}`)
                .join(', ')}
            </p>
          )}
        </div>
      )}

      {disbursing && (
        <DisburseModal
          line={disbursing}
          onClose={() => setDisbursing(null)}
          onSaved={() => {
            invalidate();
            setDisbursing(null);
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
  onClose,
  onSaved,
}: {
  line: PaymentSheetLine;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>('cash');
  const [paidOn, setPaidOn] = useState('');
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
        shortPaymentReason: shortPaymentReason || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not disburse.'),
  });

  const short = Number(paidAmount) !== line.netPayable;
  const needsAck = paymentMode === 'cash' && !acknowledgement;
  const valid =
    paidOn && paidAmount && !needsAck && (!short || shortPaymentReason);

  return (
    <Modal
      title="Disburse Payment"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="dis-mode"
          label="Payment mode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as 'cash' | 'bank')}
        >
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
        </SelectField>
        <TextField
          id="dis-date"
          label="Paid on"
          type="date"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
        />
        <TextField
          id="dis-amount"
          label="Paid amount (₹)"
          type="number"
          min="0"
          step="0.01"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          hint={`Net payable is ${rupees(line.netPayable)}.`}
        />
        {short && (
          <TextField
            id="dis-short"
            label="Short payment reason"
            value={shortPaymentReason}
            onChange={(e) => setShortPaymentReason(e.target.value)}
            hint="The difference carries forward to the next period."
          />
        )}
        {paymentMode === 'cash' && (
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">
              Acknowledgement (thumb impression / signature)
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
