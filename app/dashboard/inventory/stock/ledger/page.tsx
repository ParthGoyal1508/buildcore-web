'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  downloadInventoryExport,
  getStockLedger,
  type StockLedgerLine,
} from '@/app/lib/api/inventory';
import { ROUTES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import {
  dateLabel,
  quantity,
  rupees,
  todayIso,
  unitRate,
} from '@/app/lib/format';
import { urlString, useUrlState } from '@/app/lib/use-url-state';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { SecondaryButton, TextField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';

/**
 * One item at one store, movement by movement (036 M13, 2026-10-17).
 *
 * The stock screen gave a balance with nothing behind it: when the count in the store disagreed
 * with the screen there was no way to see which receipt, issue or transfer made the difference.
 * Here every movement in the chosen range is listed with the balance after it, between the
 * opening balance at the start of the range and the closing balance at its end — the store
 * ledger a storekeeper keeps on paper. Opened from a stock row's "Ledger"; the item, store and
 * dates are in the URL so the page can be bookmarked or sent.
 *
 * The rows are in date order and not re-sortable: a running balance read in any other order is
 * meaningless.
 */
function StockLedgerBody() {
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [filters, setFilters, query] = useUrlState({
    itemId: urlString(),
    siteId: urlString(),
    from: urlString(),
    to: urlString(),
  });
  const [exporting, setExporting] = useState(false);

  const rangeError =
    query.from && query.to && query.from > query.to
      ? 'From must be on or before To.'
      : undefined;
  const range = {
    dateFrom: query.from || undefined,
    dateTo: query.to || undefined,
  };
  const ready = Boolean(query.itemId && query.siteId);

  const ledger = useQuery({
    queryKey: [
      'inventory',
      'stock-ledger',
      companyId,
      query.itemId,
      query.siteId,
      range,
    ],
    queryFn: () => getStockLedger(query.itemId, query.siteId, range),
    enabled: ready && !rangeError,
    placeholderData: keepPreviousData,
  });
  const data = ledger.data;
  const unit = data?.unit ?? '';

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await downloadInventoryExport('stock-ledger', {
        itemId: query.itemId,
        siteId: query.siteId,
        ...range,
      });
      saveBlob(
        blob,
        `Stock ledger ${data?.itemCode ?? ''} ${data?.siteName ?? ''} ${todayIso()}.xlsx`
          .replace(/\s+/g, ' ')
          .trim(),
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Could not produce the Excel file.'));
    } finally {
      setExporting(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Stock ledger" />
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Open a ledger from the <strong>Ledger</strong> button on a row of the{' '}
          <Link href={ROUTES.inventoryStock} className="text-brand-700 hover:underline">
            Stock
          </Link>{' '}
          screen.
        </p>
      </div>
    );
  }

  const columns: Column<StockLedgerLine>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="whitespace-nowrap">{dateLabel(row.date)}</span>
      ),
    },
    {
      key: 'label',
      header: 'Particulars',
      render: (row) => (
        <span>
          {row.label}
          {row.counterparty && (
            <span className="block text-xs text-gray-500">
              {row.counterparty}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) =>
        row.reference ? (
          <span className="font-mono text-xs">{row.reference}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'in',
      header: 'In',
      className: 'text-right tabular-nums',
      render: (row) => (row.quantityIn ? quantity(row.quantityIn) : '—'),
    },
    {
      key: 'out',
      header: 'Out',
      className: 'text-right tabular-nums',
      render: (row) => (row.quantityOut ? quantity(row.quantityOut) : '—'),
    },
    {
      key: 'rate',
      header: 'Rate',
      hideOnCard: true,
      className: 'text-right tabular-nums',
      render: (row) => (row.rate === null ? '—' : unitRate(row.rate)),
    },
    {
      key: 'balance',
      header: 'Balance',
      className: 'text-right tabular-nums font-medium',
      render: (row) => quantity(row.balance),
    },
  ];

  const summary: [string, string][] = data
    ? [
        ['Opening', `${quantity(data.openingQuantity)} ${unit}`],
        ['In', `${quantity(data.inQuantity)} ${unit}`],
        ['Out', `${quantity(data.outQuantity)} ${unit}`],
        ['Closing', `${quantity(data.closingQuantity)} ${unit}`],
        ['Avg rate', unitRate(data.avgRate)],
        ['Closing value', rupees(data.closingValue)],
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeader
            title="Stock ledger"
            breadcrumbs={[{ label: 'Stock', href: ROUTES.inventoryStock }]}
          />
          <p className="text-sm text-gray-600">
            {data
              ? `${data.itemName} (${data.itemCode}) at ${data.siteName}`
              : ' '}
          </p>
        </div>
        <SecondaryButton
          type="button"
          onClick={() => void exportExcel()}
          loading={exporting}
          disabled={Boolean(rangeError) || !data}
        >
          Excel
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <TextField
          id="ledger-from"
          label="From"
          type="date"
          max={filters.to || undefined}
          value={filters.from}
          onChange={(event) => setFilters({ from: event.target.value })}
          error={rangeError}
          hint={filters.from ? undefined : 'From the first movement'}
        />
        <TextField
          id="ledger-to"
          label="To"
          type="date"
          min={filters.from || undefined}
          value={filters.to}
          onChange={(event) => setFilters({ to: event.target.value })}
          hint={filters.to ? undefined : 'Up to today'}
        />
      </div>

      {ledger.error ? (
        <QueryError error={ledger.error} onRetry={ledger.refetch} />
      ) : (
        <>
          {data && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {summary.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <ResponsiveList
            columns={columns}
            rows={data?.entries ?? []}
            rowKey={(row) => `${row.type}:${row.id}`}
            isLoading={ledger.isPending && !rangeError}
            // Date order is the meaning of a running balance; header sorting stays off.
            serverPaged
            isRefreshing={ledger.isPlaceholderData}
            emptyMessage="No movements in this period."
          />
        </>
      )}
    </div>
  );
}

export default function StockLedgerPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Date', 'Particulars', 'Reference', 'In', 'Out', 'Balance']}
          rows={8}
        />
      }
    >
      <StockLedgerBody />
    </Suspense>
  );
}
