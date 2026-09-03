'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getStock, type StockRow } from '@/app/lib/api/inventory';
import { getCategories } from '@/app/lib/api/inventory';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { useSites } from './use-inventory-refs';

/**
 * The stock position, and the four things you can do from it.
 *
 * `inStock`, `stockValue` and `belowReorderLevel` all arrive computed — the backend
 * refuses to store any of them (009 FR-014), so there is no arithmetic here to
 * disagree with it.
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
  const [siteId, setSiteId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [belowOnly, setBelowOnly] = useState(false);

  const sites = useSites();
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

  const filters = {
    ...(siteId ? { siteId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(search ? { search } : {}),
    ...(belowOnly ? { belowReorderLevel: true } : {}),
  };
  const isFiltered = Object.keys(filters).length > 0;

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'stock', filters],
    queryFn: () => getStock(filters),
  });

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
    { key: 'unit', header: 'Unit', hideOnCard: true, render: (row) => row.unit },
    {
      key: 'received',
      header: 'Received',
      hideOnCard: true,
      render: (row) => row.received,
    },
    {
      key: 'issued',
      header: 'Issued',
      hideOnCard: true,
      render: (row) => row.issued,
    },
    {
      key: 'transferIn',
      header: 'Transfer in',
      hideOnCard: true,
      render: (row) => row.transferIn,
    },
    {
      key: 'transferOut',
      header: 'Transfer out',
      hideOnCard: true,
      render: (row) => row.transferOut,
    },
    {
      key: 'inStock',
      header: 'In stock',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.inStock}</span>
          {row.belowReorderLevel && (
            // Words, not only a colour: a red number alone is invisible to anyone
            // who cannot distinguish it, and this is the one flag on the screen
            // that should prompt an action.
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
              Below reorder ({row.reorderLevel})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'avgRate',
      header: 'Avg rate',
      render: (row) => formatRupees(row.avgRate),
    },
    {
      key: 'stockValue',
      header: 'Stock value',
      render: (row) => formatRupees(row.stockValue),
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
          <select
            id="stock-site"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All stores</option>
            {(sites.data ?? []).map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
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
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Item name or code"
            className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={belowOnly}
              onChange={(event) => setBelowOnly(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Below reorder level only
          </label>
        </div>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.rows ?? []}
        rowKey={(row) => `${row.itemId}:${row.siteId}`}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={
          isFiltered ? MESSAGES.inventoryEmptyFiltered : MESSAGES.inventoryEmpty
        }
      />
    </div>
  );
}
