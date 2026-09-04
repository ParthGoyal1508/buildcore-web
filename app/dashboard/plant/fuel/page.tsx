'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  getFuelEntries,
  getFuelSummary,
  type FuelEntry,
} from '@/app/lib/api/plant';
import { MESSAGES, formatVariance } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import FuelModal from '@/app/ui/plant/fuel-modal';
import {
  usePlantEquipment,
  usePlantCompanyId,
} from '@/app/ui/plant/use-plant-refs';
import {
  CheckboxField,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

export default function FuelPage() {
  const equipment = usePlantEquipment();

  const searchParams = useSearchParams();
  // Seeded from the URL so the machine detail page can link straight to this list
  // already filtered. Read once as the initial value rather than kept in sync: the
  // dropdown below owns the filter after first render, and re-syncing would fight
  // a user who changed it.
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipmentId') ?? '',
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [varianceOnly, setVarianceOnly] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const companyId = usePlantCompanyId();

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(varianceOnly ? { varianceOnly: 'true' } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'fuel', filters],
    queryFn: () => getFuelEntries(filters),
  });

  const summary = useQuery({
    queryKey: ['plant', 'fuel', 'summary', month, companyId],
    queryFn: () => getFuelSummary(month, companyId ?? undefined),
  });

  const columns: Column<FuelEntry>[] = [
    { key: 'date', header: 'Date', render: (row) => row.date.slice(0, 10) },
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    { key: 'quantity', header: 'Litres', render: (row) => row.quantity },
    {
      key: 'rate',
      header: 'Rate',
      hideOnCard: true,
      render: (row) => formatRupees(row.rate),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatRupees(row.amount),
    },
    {
      key: 'vendor',
      header: 'Supplier',
      hideOnCard: true,
      render: (row) => row.vendorName ?? '—',
    },
    {
      key: 'variance',
      header: 'Variance',
      // Signed, so under-consumption reads differently from over-consumption. The
      // alert badge is separate: a variance can be recorded without exceeding the
      // machine category's own configured threshold.
      render: (row) => (
        <span className="flex items-center gap-2">
          <span>{formatVariance(row.variancePercent)}</span>
          {row.varianceAlert && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
              Over
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Fuel</h1>
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          Record fuel
        </SecondaryButton>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Monthly summary
          </h2>
          <TextField
            id="fuel-summary-month"
            label="Month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
        {summary.data ? (
          <>
            <p className="mt-3 text-sm text-gray-700">
              {summary.data.totalQuantity} litres ·{' '}
              {formatRupees(summary.data.totalAmount)} across{' '}
              {summary.data.items.length}{' '}
              {summary.data.items.length === 1 ? 'machine' : 'machines'}
            </p>
            <ResponsiveList
              columns={[
                {
                  key: 'machine',
                  header: 'Machine',
                  render: (row: (typeof summary.data.items)[number]) =>
                    `${row.equipmentCode} · ${row.equipmentName}`,
                },
                {
                  key: 'litres',
                  header: 'Litres',
                  render: (row: (typeof summary.data.items)[number]) =>
                    row.totalQuantity,
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (row: (typeof summary.data.items)[number]) =>
                    formatRupees(row.totalAmount),
                },
                {
                  key: 'alerts',
                  header: 'Flagged days',
                  render: (row: (typeof summary.data.items)[number]) =>
                    row.alertCount === 0 ? '—' : row.alertCount,
                },
              ]}
              rows={summary.data.items}
              rowKey={(row) => row.equipmentId}
              emptyMessage="No fuel was drawn this month."
            />
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="fuel-filter-equipment"
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
          {(equipment.data ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="fuel-filter-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
        />
        <TextField
          id="fuel-filter-to"
          label="To"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
        />
        <div className="flex items-end pb-2">
          <CheckboxField
            id="fuel-filter-variance"
            label="Flagged entries only"
            checked={varianceOnly}
            onChange={(event) => {
              setVarianceOnly(event.target.checked);
              setPage(1);
            }}
          />
        </div>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage={MESSAGES.plantFuelEmpty}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="entry"
        plural="entries"
      />

      {showModal && <FuelModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
