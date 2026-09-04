'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createServiceBill,
  getServiceBills,
  payServiceBill,
  verifyServiceBill,
  type MaintenanceJob,
  type ServiceBill,
} from '@/app/lib/api/plant';
import { MESSAGES, plantLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import { usePlantVendors } from './use-plant-refs';

/**
 * Record a third-party service bill against a job.
 *
 * TDS Amount and Net Payable are live read-only computations, never inputs
 * (web FR-013, SC-A02). TDS is withheld on the gross only — tax collected for the
 * state is not the vendor's income, and deducting on it would short them every bill.
 * The preview mirrors the server's own arithmetic exactly so the figure shown before
 * saving is the figure saved.
 */
function ServiceBillModal({
  job,
  onClose,
}: {
  job: MaintenanceJob;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const vendors = usePlantVendors();

  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [grossAmount, setGrossAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [tdsPercent, setTdsPercent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const gross = grossAmount === '' ? 0 : Number(grossAmount);
  const tax = taxAmount === '' ? 0 : Number(taxAmount);
  const tds = tdsPercent === '' ? null : Number(tdsPercent);
  const tdsAmount = tds === null ? null : Math.round(gross * tds) / 100;
  const netPayable =
    tdsAmount === null
      ? null
      : Math.round((gross + tax - tdsAmount) * 100) / 100;

  const save = useMutation({
    mutationFn: () =>
      createServiceBill({
        maintenanceJobId: job.id,
        vendorId,
        billNumber: billNumber.trim(),
        billDate,
        grossAmount: gross,
        ...(taxAmount ? { taxAmount: tax } : {}),
        ...(tdsPercent ? { tdsPercent: Number(tdsPercent) } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title="Record a service bill"
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="service-bill-form"
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="service-bill-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="bill-vendor"
            label="Workshop"
            required
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
          >
            <option value="">Select a vendor</option>
            {(vendors.data ?? []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </SelectField>

          <TextField
            id="bill-number"
            label="Bill number"
            required
            value={billNumber}
            onChange={(event) => setBillNumber(event.target.value)}
          />

          <TextField
            id="bill-date"
            label="Bill date"
            type="date"
            required
            value={billDate}
            onChange={(event) => setBillDate(event.target.value)}
          />

          <TextField
            id="bill-gross"
            label="Gross amount (₹)"
            type="number"
            required
            min={0}
            step="0.01"
            value={grossAmount}
            onChange={(event) => setGrossAmount(event.target.value)}
          />

          <TextField
            id="bill-tax"
            label="Tax (₹)"
            type="number"
            min={0}
            step="0.01"
            value={taxAmount}
            onChange={(event) => setTaxAmount(event.target.value)}
          />

          <TextField
            id="bill-tds"
            label="TDS (%)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={tdsPercent}
            onChange={(event) => setTdsPercent(event.target.value)}
            hint="Leave blank to use the vendor's own rate from Partners."
          />
        </div>

        {/* Read-only and computed (web FR-013, SC-A02). */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              TDS amount
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {tdsAmount === null
                ? "The vendor's own rate applies"
                : formatRupees(tdsAmount)}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Net payable
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {netPayable === null
                ? 'Computed on save'
                : formatRupees(netPayable)}
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Third-party service bills raised against one maintenance job (006 US11). */
export default function ServiceBillPanel({ job }: { job: MaintenanceJob }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bills = useQuery({
    queryKey: ['plant', 'service-bills', { maintenanceJobId: job.id }],
    queryFn: () => getServiceBills({ maintenanceJobId: job.id, pageSize: 100 }),
    select: (page) => page.items,
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyServiceBill(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not verify that bill.',
      ),
  });

  const pay = useMutation({
    mutationFn: ({
      id,
      paidAmount,
      paymentReference,
    }: {
      id: string;
      paidAmount: number;
      paymentReference: string;
    }) =>
      payServiceBill(id, {
        paidOn: new Date().toISOString().slice(0, 10),
        paidAmount,
        paymentReference,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not record that payment.',
      ),
  });

  const columns: Column<ServiceBill>[] = [
    { key: 'number', header: 'Bill', render: (row) => row.billNumber },
    { key: 'vendor', header: 'Workshop', render: (row) => row.vendorName },
    {
      key: 'date',
      header: 'Date',
      hideOnCard: true,
      render: (row) => row.billDate.slice(0, 10),
    },
    {
      key: 'gross',
      header: 'Gross',
      hideOnCard: true,
      render: (row) => formatRupees(row.grossAmount),
    },
    {
      key: 'tds',
      header: 'TDS',
      hideOnCard: true,
      render: (row) => `${formatRupees(row.tdsAmount)} (${row.tdsPercent}%)`,
    },
    {
      key: 'net',
      header: 'Net payable',
      render: (row) => formatRupees(row.netPayable),
    },
    {
      key: 'status',
      header: 'Verification',
      render: (row) => (
        <StatusBadge status={row.status} label={plantLabel(row.status)} />
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => (
        <span className="flex flex-col gap-1">
          <StatusBadge
            status={row.paymentStatus}
            label={plantLabel(row.paymentStatus)}
          />
          {row.paidAmount > 0 && row.paymentStatus !== 'paid' && (
            <span className="text-xs text-gray-500">
              {formatRupees(row.paidAmount)} of {formatRupees(row.netPayable)}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Service bills</h3>
        {/* Permitted on a closed job on purpose: invoices routinely arrive weeks
            after the work is finished (006 US11 scenario 7). */}
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          Record a bill
        </SecondaryButton>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={bills.data ?? []}
        rowKey={(row) => row.id}
        isLoading={bills.isPending}
        emptyMessage={MESSAGES.plantServiceBillsEmpty}
        actions={(row) => (
          <>
            {row.status === 'pending_verification' && (
              <RowAction
                disabled={verify.isPending}
                onClick={() => verify.mutate(row.id)}
              >
                Verify
              </RowAction>
            )}
            {row.paymentStatus !== 'paid' && (
              <RowAction
                // Disabled with the reason in a tooltip rather than failing on
                // submit (web FR-016).
                disabled={row.status !== 'verified' || pay.isPending}
                title={
                  row.status !== 'verified'
                    ? MESSAGES.plantUnverifiedPay
                    : undefined
                }
                onClick={() => {
                  const outstanding =
                    Math.round((row.netPayable - row.paidAmount) * 100) / 100;
                  const amount = window.prompt(
                    `Amount paid (outstanding ${outstanding}):`,
                    String(outstanding),
                  );
                  if (!amount) return;
                  const reference = window.prompt('Payment reference:');
                  if (!reference || !reference.trim()) return;
                  pay.mutate({
                    id: row.id,
                    paidAmount: Number(amount),
                    paymentReference: reference.trim(),
                  });
                }}
              >
                Pay
              </RowAction>
            )}
          </>
        )}
      />

      {showModal && (
        <ServiceBillModal job={job} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
