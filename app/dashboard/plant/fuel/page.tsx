'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  downloadFuelExport,
  getEquipmentDetail,
  getFuelEntries,
  getFuelSummary,
  type FuelEntry,
} from '@/app/lib/api/plant';
import { MESSAGES, formatVariance } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import {
  currentPeriod,
  dateLabel,
  quantity3,
  rupees,
  todayIso,
} from '@/app/lib/format';
import {
  urlBoolean,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import Pager from '@/app/ui/inventory/pager';
import PageHeader from '@/app/ui/page-header';
import FuelExceptions from '@/app/ui/plant/fuel-exceptions';
import FuelModal from '@/app/ui/plant/fuel-modal';
import MonthSelect from '@/app/ui/plant/month-select';
import { EquipmentPicker, equipmentOption } from '@/app/ui/plant/pickers';
import { usePlantCompanyId } from '@/app/ui/plant/use-plant-refs';
import QueryError from '@/app/ui/query-error';
import {
  CheckboxField,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { useToast } from '@/app/ui/toast';
import StatusBadge from '@/app/ui/status-badge';

const litres = (value: number) => `${quantity3(value)} litres`;

/**
 * The fuel register.
 *
 * 036: filters (and the summary month) live in the URL; the machine filter is a server-searched
 * picker; litres and rupees are formatted; the filtered list downloads as Excel (K16); the summary
 * month is two selects rather than `type="month"`; and a summary that fails to load says so with
 * Retry rather than spinning forever (K12).
 */
export default function FuelPage() {
  const toast = useToast();
  const [filters, setFilters, query] = useUrlState(
    {
      equipmentId: urlString(),
      dateFrom: urlString(),
      dateTo: urlString(),
      varianceOnly: urlBoolean(),
      month: urlString(currentPeriod()),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const companyId = usePlantCompanyId();

  const filterQuery = {
    ...(companyId ? { companyId } : {}),
    ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
    ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
    ...(query.dateTo ? { dateTo: query.dateTo } : {}),
    ...(query.varianceOnly ? { varianceOnly: 'true' } : {}),
  };
  const listQuery = { ...filterQuery, page: query.page };

  const list = useQuery({
    queryKey: ['plant', 'fuel', listQuery],
    queryFn: () => getFuelEntries(listQuery),
    placeholderData: keepPreviousData,
  });

  const summary = useQuery({
    queryKey: ['plant', 'fuel', 'summary', query.month, companyId],
    queryFn: () => getFuelSummary(query.month, companyId ?? undefined),
    placeholderData: keepPreviousData,
  });

  const machine = useQuery({
    queryKey: ['plant', 'equipment', query.equipmentId],
    queryFn: () => getEquipmentDetail(query.equipmentId),
    enabled: Boolean(query.equipmentId),
  });

  async function exportList() {
    setExporting(true);
    try {
      const { blob, filename } = await downloadFuelExport(filterQuery);
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the fuel entries.'));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<FuelEntry>[] = [
    { key: 'date', header: 'Date', render: (row) => dateLabel(row.date) },
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    {
      key: 'quantity',
      header: 'Litres',
      className: 'text-right tabular-nums',
      render: (row) => litres(row.quantity),
    },
    {
      key: 'rate',
      header: 'Rate',
      hideOnCard: true,
      className: 'text-right tabular-nums',
      render: (row) => `${rupees(row.rate)}/litre`,
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right tabular-nums',
      render: (row) => rupees(row.amount),
    },
    {
      key: 'site',
      header: 'Site',
      hideOnCard: true,
      render: (row) => row.siteName ?? '—',
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
            <StatusBadge tone="warning" label={'Over'} />
          )}
        </span>
      ),
    },
  ];

  type SummaryRow = NonNullable<typeof summary.data>['items'][number];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Fuel" />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            loading={exporting}
            onClick={() => void exportList()}
          >
            Excel
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setShowModal(true)}>
            Record fuel
          </SecondaryButton>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Monthly summary
          </h2>
          <div className="w-full sm:w-72">
            <MonthSelect
              id="fuel-summary-month"
              label="Month"
              value={filters.month}
              onChange={(month) => setFilters({ month })}
            />
          </div>
        </div>
        {summary.isError ? (
          <QueryError
            compact
            className="mt-3"
            error={summary.error}
            fallback="The monthly summary could not be loaded."
            onRetry={summary.refetch}
          />
        ) : (
          <>
            {summary.data && (
              <p className="mt-3 text-sm text-gray-700">
                {litres(summary.data.totalQuantity)} ·{' '}
                {rupees(summary.data.totalAmount)} across{' '}
                {summary.data.items.length}{' '}
                {summary.data.items.length === 1 ? 'machine' : 'machines'}
              </p>
            )}
            <ResponsiveList
              columns={[
                {
                  key: 'machine',
                  header: 'Machine',
                  render: (row: SummaryRow) =>
                    `${row.equipmentCode} · ${row.equipmentName}`,
                },
                {
                  key: 'litres',
                  header: 'Litres',
                  className: 'text-right tabular-nums',
                  render: (row: SummaryRow) => litres(row.totalQuantity),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  className: 'text-right tabular-nums',
                  render: (row: SummaryRow) => rupees(row.totalAmount),
                },
                {
                  key: 'alerts',
                  header: 'Flagged days',
                  render: (row: SummaryRow) =>
                    row.alertCount === 0 ? '—' : row.alertCount,
                },
              ]}
              rows={summary.data?.items ?? []}
              rowKey={(row) => row.equipmentId}
              isLoading={summary.isPending}
              skeletonRows={3}
              emptyMessage="No fuel was drawn this month."
            />
          </>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EquipmentPicker
          id="fuel-filter-equipment"
          label="Machine"
          emptyLabel="All machines"
          value={filters.equipmentId}
          selectedOption={machine.data ? equipmentOption(machine.data) : null}
          onChange={(id) => setFilters({ equipmentId: id })}
        />
        <TextField
          id="fuel-filter-from"
          label="From"
          type="date"
          max={filters.dateTo || todayIso()}
          value={filters.dateFrom}
          onChange={(event) => setFilters({ dateFrom: event.target.value })}
        />
        <TextField
          id="fuel-filter-to"
          label="To"
          type="date"
          min={filters.dateFrom || undefined}
          value={filters.dateTo}
          onChange={(event) => setFilters({ dateTo: event.target.value })}
        />
        <div className="flex items-end pb-2">
          <CheckboxField
            id="fuel-filter-variance"
            label="Flagged entries only"
            checked={filters.varianceOnly}
            onChange={(event) =>
              setFilters({ varianceOnly: event.target.checked })
            }
          />
        </div>
      </div>

      {/* 020 FR-001 – FR-006 (`bugs.md` item 13). Above the entry list and below the summary:
          the exceptions are the part of this screen somebody has to act on, and the entries below
          are the evidence. A register nobody scrolls to is a register nobody clears. */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <FuelExceptions />
      </section>

      <ResponsiveList
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isPending}
        isRefreshing={list.isFetching && !list.isPending}
        error={list.isError ? list.error : undefined}
        onRetry={list.refetch}
        serverPaged
        emptyMessage={MESSAGES.plantFuelEmpty}
      />

      <Pager
        total={list.data?.total ?? 0}
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="entry"
        plural="entries"
      />

      {showModal && <FuelModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
