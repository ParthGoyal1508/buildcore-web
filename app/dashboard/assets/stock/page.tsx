'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  downloadAssetStock,
  getAssetStockPage,
  type AssetStockRow,
} from '@/app/lib/api/assets';
import { errorMessage } from '@/app/lib/api/client';
import {
  ASSET_TRACKING_MODES,
  MESSAGES,
  ROUTES,
  assetsLabel,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import {
  useAssetCategories,
  useAssetsCompanyId,
} from '@/app/ui/assets/use-asset-refs';
import Pager from '@/app/ui/inventory/pager';
import PageHeader from '@/app/ui/page-header';
import { SitePicker } from '@/app/ui/plant/pickers';
import {
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { useToast } from '@/app/ui/toast';

/**
 * Where everything is (spec US3, FR-007).
 *
 * On Hand, Allocated and In Transit are three columns and never one netted figure.
 * A single "available" number makes an in-flight transfer look like loss — the units
 * have left one site and not yet arrived at the other, and a store keeper reading a
 * drop with no explanation raises a shortage that is not there. The Total column is
 * their sum, so the three can be seen to reconcile against the registered pool while
 * a transfer is open (SC-002).
 *
 * 036 L4: paged and searched on the server (site, category, tracking mode, and the asset's code or
 * name), with the filters in the URL and an Excel download of what the filters show. It used to
 * fetch every row and filter on the screen, with no paging, search or export.
 */
export default function AssetStockPage() {
  const toast = useToast();
  const companyId = useAssetsCompanyId();
  const categories = useAssetCategories();
  const [filters, setFilters, query] = useUrlState(
    {
      q: urlString(),
      siteId: urlString(),
      categoryId: urlString(),
      trackingMode: urlString(),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  const [exporting, setExporting] = useState(false);

  const filterQuery = {
    ...(companyId ? { companyId } : {}),
    ...(query.q.trim() ? { q: query.q.trim() } : {}),
    ...(query.siteId ? { siteId: query.siteId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.trackingMode ? { trackingMode: query.trackingMode } : {}),
  };
  const listQuery = { ...filterQuery, page: query.page };

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['assets', 'stock', 'page', listQuery],
    queryFn: () => getAssetStockPage(listQuery),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];

  async function exportList() {
    setExporting(true);
    try {
      const { blob, filename } = await downloadAssetStock(filterQuery);
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(errorMessage(err, MESSAGES.assetsExportFailed));
    } finally {
      setExporting(false);
    }
  }

  const quantity = (row: AssetStockRow, value: number) => {
    const unit = row.unitOfMeasure;
    const number = value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
    return unit ? `${number} ${unit}` : number;
  };

  const columns: Column<AssetStockRow>[] = [
    {
      key: 'asset',
      header: 'Asset',
      render: (row) => (
        <Link
          href={ROUTES.assetsAsset(row.assetId)}
          className="text-brand-700 underline hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {row.assetCode}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', render: (row) => row.assetName },
    { key: 'site', header: 'Site', render: (row) => row.siteName },
    {
      key: 'onHand',
      header: 'On hand',
      render: (row) => quantity(row, row.onHand),
    },
    {
      key: 'allocated',
      header: 'Allocated',
      render: (row) => quantity(row, row.allocated),
    },
    {
      key: 'inTransit',
      header: 'In transit',
      render: (row) =>
        row.inTransit > 0 ? (
          <span className="text-brand-700">{quantity(row, row.inTransit)}</span>
        ) : (
          quantity(row, row.inTransit)
        ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => quantity(row, row.total),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Asset Stock" />
        <SecondaryButton
          type="button"
          loading={exporting}
          onClick={() => void exportList()}
        >
          Excel
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="stock-search"
          label="Search"
          type="search"
          placeholder="Asset code or name"
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
        />
        <SitePicker
          id="stock-filter-site"
          label="Site"
          emptyLabel="All sites"
          value={filters.siteId}
          onChange={(id) => setFilters({ siteId: id })}
        />
        <SelectField
          id="stock-filter-category"
          label="Category"
          value={filters.categoryId}
          onChange={(event) => setFilters({ categoryId: event.target.value })}
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="stock-filter-mode"
          label="Tracking mode"
          value={filters.trackingMode}
          onChange={(event) => setFilters({ trackingMode: event.target.value })}
        >
          <option value="">Serialised and bulk</option>
          {ASSET_TRACKING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {assetsLabel(mode)}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={rows}
        rowKey={(row) => `${row.assetId}:${row.siteId}`}
        isLoading={isPending}
        isRefreshing={isFetching && !isPending}
        error={isError ? error : undefined}
        onRetry={refetch}
        serverPaged
        emptyMessage={MESSAGES.assetsStockEmpty}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="row"
      />
    </div>
  );
}
