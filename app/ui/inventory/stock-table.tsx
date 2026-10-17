'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  downloadInventoryExport,
  getStock,
  type StockRow,
} from '@/app/lib/api/inventory';
import { getCategories } from '@/app/lib/api/inventory';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { quantity, rupees, todayIso, unitRate } from '@/app/lib/format';
import {
  urlBoolean,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import {
  RowActionLink,
  SecondaryButton,
  fieldClass,
} from '@/app/ui/settings/form-fields';
import Pager from './pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { useToast } from '@/app/ui/toast';
import { searchSites } from './inventory-search';
import { selectClass } from '@/app/ui/settings/form-fields';

/** The ledger of one item at one store (036 M13). */
export const stockLedgerHref = (itemId: string, siteId: string) =>
  `${ROUTES.inventoryStock}/ledger?${new URLSearchParams({ itemId, siteId })}`;

/**
 * The stock position, and the four things you can do from it.
 *
 * `inStock`, `stockValue` and `belowReorderLevel` all arrive computed — the backend
 * refuses to store any of them (009 FR-014), so there is no arithmetic here to
 * disagree with it.
 *
 * 036 M5, M13 (2026-10-17): filters in the URL with the search debounced (it fired a request per
 * keystroke), the store filter a server search, the valuation of the whole filter (not just this
 * page) above the table, an Excel export, and a Ledger link per row to the item's movements at
 * that store.
 *
 * Rendered under a `<Suspense>` boundary by the page: `useUrlState` reads the search params.
 */
export default function StockTable({
  onNewPurchase,
  onNewIssue,
  onNewTransfer,
  onOpenMasters,
}: {
  onNewPurchase: () => void;
  onNewIssue: () => void;
  onNewTransfer: () => void;
  onOpenMasters: () => void;
}) {
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [filters, setFilters, query] = useUrlState(
    {
      site: urlString(),
      category: urlString(),
      q: urlString(),
      below: urlBoolean(),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  const [exporting, setExporting] = useState(false);

  const categories = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: getCategories,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  // The masters are a Settings-owned master (009 research.md §1). Offering the
  // button without the permission would open a dialog whose every request 403s.
  const canEditMasters = user?.permissions.includes('SETTINGS') ?? false;

  const stockFilters = {
    siteId: query.site || undefined,
    categoryId: query.category || undefined,
    search: query.q.trim() || undefined,
    belowReorderLevel: query.below || undefined,
  };
  const isFiltered = Object.values(stockFilters).some(Boolean);
  const params = { ...stockFilters, page: query.page };

  const list = useQuery({
    queryKey: ['inventory', 'stock', companyId, params],
    queryFn: () => getStock(params),
    placeholderData: keepPreviousData,
  });
  const data = list.data;
  const siteRow = data?.rows.find((row) => row.siteId === query.site);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await downloadInventoryExport('stock', stockFilters);
      saveBlob(blob, `Stock ${todayIso()}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not produce the Excel file.'));
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<StockRow>[] = [
    {
      key: 'item',
      header: 'Item',
      render: (row) => (
        <div>
          <span className="font-medium text-gray-900">{row.itemName}</span>
          <span className="block text-xs text-gray-500">{row.itemCode}</span>
        </div>
      ),
    },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'category',
      header: 'Category',
      hideOnCard: true,
      render: (row) => row.category,
    },
    {
      key: 'unit',
      header: 'Unit',
      hideOnCard: true,
      render: (row) => row.unit,
    },
    {
      key: 'received',
      header: 'Received',
      hideOnCard: true,
      render: (row) => quantity(row.received),
    },
    {
      key: 'issued',
      header: 'Issued',
      hideOnCard: true,
      render: (row) => quantity(row.issued),
    },
    {
      key: 'transferIn',
      header: 'Transfer in',
      hideOnCard: true,
      render: (row) => quantity(row.transferIn),
    },
    {
      key: 'transferOut',
      header: 'Transfer out',
      hideOnCard: true,
      render: (row) => quantity(row.transferOut),
    },
    {
      key: 'inStock',
      header: 'In stock',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{quantity(row.inStock)}</span>
          {row.belowReorderLevel && (
            // Words, not only a colour: a red number alone is invisible to anyone
            // who cannot distinguish it, and this is the one flag on the screen
            // that should prompt an action.
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
              Below reorder ({quantity(row.reorderLevel)})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'avgRate',
      header: 'Avg rate',
      className: 'text-right tabular-nums',
      render: (row) => unitRate(row.avgRate),
    },
    {
      key: 'stockValue',
      header: 'Stock value',
      className: 'text-right tabular-nums',
      render: (row) => rupees(row.stockValue),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <SecondaryButton type="button" onClick={onNewPurchase}>
          New purchase
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onNewIssue}>
          New issue
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onNewTransfer}>
          New transfer
        </SecondaryButton>
        {canEditMasters && (
          <SecondaryButton type="button" onClick={onOpenMasters}>
            Item masters
          </SecondaryButton>
        )}
        <SecondaryButton
          type="button"
          onClick={() => void exportExcel()}
          loading={exporting}
        >
          Excel
        </SecondaryButton>
      </div>

      {/* A grid, not a flex row: as flex items these fields size to their labels
          rather than their content, and the option text spills over the border. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="stock-site"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Store
          </label>
          <AsyncSelect
            id="stock-site"
            value={filters.site}
            onChange={(id) => setFilters({ site: id })}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={
              siteRow ? { id: siteRow.siteId, label: siteRow.siteName } : null
            }
            emptyLabel="All stores"
          />
        </div>

        <div>
          <label
            htmlFor="stock-category"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Category
          </label>
          <select
            id="stock-category"
            value={filters.category}
            onChange={(event) => setFilters({ category: event.target.value })}
            className={selectClass}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="stock-search"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Search
          </label>
          <input
            id="stock-search"
            type="search"
            autoComplete="off"
            value={filters.q}
            onChange={(event) => setFilters({ q: event.target.value })}
            placeholder="Item name or code"
            className={fieldClass}
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={filters.below}
              onChange={(event) => setFilters({ below: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Below reorder level only
          </label>
        </div>
      </div>

      {data?.totals && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Stock value{isFiltered ? ' for this filter' : ''}:{' '}
          <span className="font-medium tabular-nums">
            {rupees(data.totals.stockValue)}
          </span>
          <span className="text-gray-500">
            {' '}
            across {data.total} {data.total === 1 ? 'row' : 'rows'}
          </span>
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={data?.rows ?? []}
        rowKey={(row) => `${row.itemId}:${row.siteId}`}
        isLoading={list.isPending}
        error={list.error}
        onRetry={list.refetch}
        serverPaged
        isRefreshing={list.isPlaceholderData}
        actions={(row) => (
          <RowActionLink href={stockLedgerHref(row.itemId, row.siteId)}>
            Ledger
          </RowActionLink>
        )}
        emptyMessage={
          isFiltered ? MESSAGES.inventoryEmptyFiltered : MESSAGES.inventoryEmpty
        }
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="stock row"
      />
    </div>
  );
}
