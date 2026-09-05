'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { getAssetStock, type AssetStockRow } from '@/app/lib/api/assets';
import {
  ASSET_TRACKING_MODES,
  MESSAGES,
  ROUTES,
  assetsLabel,
} from '@/app/lib/constants';
import {
  useAllAssets,
  useAssetCategories,
  useAssetSites,
  useAssetsCompanyId,
} from '@/app/ui/assets/use-asset-refs';
import { lusitana } from '@/app/ui/fonts';
import { SelectField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

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
 * Filtering is client-side over one fetch. The stock endpoint returns a row per
 * asset-site pair and a company has hundreds, not millions; a round trip per filter
 * change would cost more than it saves and would make the tracking-mode filter — which
 * the API does not offer — impossible without a second endpoint.
 */
export default function AssetStockPage() {
  const companyId = useAssetsCompanyId();
  const sites = useAssetSites();
  const categories = useAssetCategories();
  const assets = useAllAssets();

  const [siteId, setSiteId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [trackingMode, setTrackingMode] = useState('');

  const { data, isPending, isError } = useQuery({
    queryKey: ['assets', 'stock', 'all', companyId],
    queryFn: () => getAssetStock({ ...(companyId ? { companyId } : {}) }),
  });

  const modeByAsset = new Map(
    (assets.data ?? []).map((asset) => [
      asset.id,
      { mode: asset.trackingMode, unit: asset.unitOfMeasure },
    ]),
  );

  const rows = (data ?? []).filter((row) => {
    if (siteId && row.siteId !== siteId) return false;
    if (categoryId && row.categoryId !== categoryId) return false;
    if (trackingMode && modeByAsset.get(row.assetId)?.mode !== trackingMode) {
      return false;
    }
    return true;
  });

  const quantity = (row: AssetStockRow, value: number) => {
    const unit = modeByAsset.get(row.assetId)?.unit;
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
          className="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
          <span className="text-blue-700">{quantity(row, row.inTransit)}</span>
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
      <h1 className={`${lusitana.className} text-2xl`}>Asset Stock</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          id="stock-filter-site"
          label="Site"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">All sites</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="stock-filter-category"
          label="Category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
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
          value={trackingMode}
          onChange={(event) => setTrackingMode(event.target.value)}
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
        error={isError ? MESSAGES.assetsLoadFailed : undefined}
        emptyMessage={MESSAGES.assetsStockEmpty}
      />
    </div>
  );
}
