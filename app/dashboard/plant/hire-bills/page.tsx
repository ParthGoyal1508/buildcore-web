'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getHireBills,
  payHireBill,
  verifyHireBill,
  type HireBill,
} from '@/app/lib/api/plant';
import {
  HIRE_BILL_STATUSES,
  MESSAGES,
  plantLabel,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import HireBillModal from '@/app/ui/plant/hire-bill-modal';
import {
  usePlantEquipment,
  usePlantVendors,
} from '@/app/ui/plant/use-plant-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function HireBillsPage() {
  const queryClient = useQueryClient();
  const equipment = usePlantEquipment();
  const vendors = usePlantVendors();

  const searchParams = useSearchParams();
  // Seeded from the URL so the machine detail page can link straight to this list
  // already filtered. Read once as the initial value rather than kept in sync: the
  // dropdown below owns the filter after first render, and re-syncing would fight
  // a user who changed it.
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipmentId') ?? '',
  );
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    page,
    ...(equipmentId ? { equipmentId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(status ? { status } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'hire-bills', filters],
    queryFn: () => getHireBills(filters),
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyHireBill(id),
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
      paymentReference,
    }: {
      id: string;
      paymentReference: string;
    }) =>
      payHireBill(id, {
        paymentDate: new Date().toISOString().slice(0, 10),
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

  const columns: Column<HireBill>[] = [
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    { key: 'vendor', header: 'Vendor', render: (row) => row.vendorName },
    {
      key: 'period',
      header: 'Period',
      render: (row) =>
        `${row.billingPeriodFrom.slice(0, 10)} → ${row.billingPeriodTo.slice(0, 10)}`,
    },
    {
      key: 'hours',
      header: 'Billed / logged',
      // Both figures side by side, because the whole point of verification is
      // comparing them. A variance is recorded, never blocked — an admin decides.
      render: (row) => (
        <span className="flex flex-col">
          <span>
            {row.billedHours} / {row.logbookHours}
          </span>
          {row.variance !== 0 && (
            <span
              className={
                row.variance > 0 ? 'text-xs text-orange-700' : 'text-xs text-gray-500'
              }
            >
              {row.variance > 0 ? '+' : ''}
              {row.variance} vs logbook
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      hideOnCard: true,
      render: (row) => formatRupees(row.rate),
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
      render: (row) =>
        row.tdsRate === null
          ? '—'
          : `${formatRupees(row.tdsAmount)} (${row.tdsRate}%)`,
    },
    {
      key: 'net',
      header: 'Net payable',
      render: (row) => formatRupees(row.netPayable),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={plantLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Hire Bills</h1>
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          Raise a bill
        </SecondaryButton>
      </div>

      {data && (
        <p className="text-sm text-gray-600">
          {data.pendingVerificationCount} awaiting verification ·{' '}
          {formatRupees(data.unpaidTotal)} unpaid
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="hire-filter-equipment"
          label="Machine"
          value={equipmentId}
          onChange={(event) => {
            setEquipmentId(event.target.value);
            // Back to the first page: narrowing the list while on page three
            // would show an empty screen for a filter that matches.
            setPage(1);
          }}
        >
          <option value="">All machines</option>
          {(equipment.data ?? [])
            .filter((row) => row.ownership === 'hired')
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          id="hire-filter-vendor"
          label="Vendor"
          value={vendorId}
          onChange={(event) => {
            setVendorId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All vendors</option>
          {(vendors.data ?? []).map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="hire-filter-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {HIRE_BILL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage={MESSAGES.plantHireBillsEmpty}
        actions={(row) => (
          <>
            {row.status === 'pending_verification' && (
              <RowAction
                disabled={verify.isPending}
                onClick={() => {
                  // The variance is surfaced in the confirmation rather than
                  // blocking: verification is an admin decision, not a gate.
                  const confirmed =
                    row.variance === 0 ||
                    window.confirm(
                      MESSAGES.plantConfirmVerifyHireBill(
                        `${row.variance > 0 ? '+' : ''}${row.variance}`,
                      ),
                    );
                  if (confirmed) verify.mutate(row.id);
                }}
              >
                Verify
              </RowAction>
            )}
            {row.status !== 'paid' && (
              <RowAction
                disabled={row.status !== 'verified' || pay.isPending}
                title={
                  row.status !== 'verified'
                    ? MESSAGES.plantUnverifiedPay
                    : undefined
                }
                onClick={() => {
                  const reference = window.prompt('Payment reference:');
                  if (reference && reference.trim()) {
                    pay.mutate({
                      id: row.id,
                      paymentReference: reference.trim(),
                    });
                  }
                }}
              >
                Pay
              </RowAction>
            )}
          </>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="bill"
      />

      {showModal && <HireBillModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
