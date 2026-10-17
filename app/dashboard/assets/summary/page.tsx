'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  exportAssetRegister,
  getAssetSummary,
  type SummaryBucket,
} from '@/app/lib/api/assets';
import { errorMessage } from '@/app/lib/api/client';
import {
  ACTIVE_ASSET_STATUSES,
  MESSAGES,
  assetsLabel,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { useAssetsCompanyId } from '@/app/ui/assets/use-asset-refs';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { todayIso, dateLabel } from '@/app/lib/format';

type Grouping = 'category' | 'status' | 'project';

/**
 * What the register is worth, grouped three ways (spec US3).
 *
 * Every figure comes from the API and none is computed here (spec FR-011) — the same
 * depreciation arithmetic feeding two implementations is how a register and a summary
 * come to disagree about the same asset. The wording is deliberately plain: "Value
 * now", not "written-down value"; a total, not a schedule. This is a store screen.
 *
 * Scrapped assets are counted in their own status bucket and excluded from the active
 * totals shown at the top (spec FR-021), because a company that wrote off a hundred
 * thousand rupees of scaffolding still has that in its history and does not still have
 * it on site.
 */
export default function AssetSummaryPage() {
  const companyId = useAssetsCompanyId();
  const [grouping, setGrouping] = useState<Grouping>('category');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isPending, isError, error: loadError, refetch } = useQuery({
    queryKey: ['assets', 'summary', companyId],
    queryFn: () => getAssetSummary(companyId ?? undefined),
  });

  /**
   * Downloads the workbook.
   *
   * Synchronous: the API builds and streams it in the request, so there is no job to
   * poll and no progress to show beyond the button's own pending state. Fetched
   * rather than linked for the reason every authenticated download here is — the
   * token lives in memory and never appears in a URL.
   */
  async function download() {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportAssetRegister(companyId ?? undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asset-register-${todayIso()}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(errorMessage(err, MESSAGES.assetsExportFailed));
    } finally {
      setExporting(false);
    }
  }

  const buckets: SummaryBucket[] =
    grouping === 'category'
      ? (data?.byCategory ?? [])
      : grouping === 'status'
        ? (data?.byStatus ?? [])
        : (data?.byProject ?? []);

  const label = (bucket: SummaryBucket) => {
    if (grouping === 'status') return assetsLabel(bucket.label);
    // 036 L4: the API names each project bucket, so project 201 onward — and every project
    // while a 200-row dropdown list was still loading — no longer reads "Unknown project".
    if (grouping === 'project') {
      return bucket.key === 'unallocated' ? 'Not on a project' : bucket.label;
    }
    return bucket.label;
  };

  const columns: Column<SummaryBucket>[] = [
    { key: 'label', header: 'Group', render: (bucket) => label(bucket) },
    {
      key: 'count',
      header: 'Assets',
      render: (bucket) => bucket.count.toLocaleString('en-IN'),
    },
    {
      key: 'cost',
      header: 'Original cost',
      render: (bucket) => formatRupees(bucket.purchaseCost),
    },
    {
      key: 'depreciation',
      header: 'Value lost so far',
      render: (bucket) => formatRupees(bucket.accumulatedDepreciation),
    },
    {
      key: 'value',
      header: 'Value now',
      render: (bucket) => formatRupees(bucket.bookValue),
    },
  ];

  // Scrapped assets sit in their own bucket and are kept out of the headline
  // figures — see the header.
  const scrapped = (data?.byStatus ?? []).find(
    (bucket) => bucket.key === 'scrapped',
  );
  const activeCount = (data?.byStatus ?? [])
    .filter((bucket) => ACTIVE_ASSET_STATUSES.includes(bucket.key))
    .reduce((sum, bucket) => sum + bucket.count, 0);
  const activeValue = (data?.byStatus ?? [])
    .filter((bucket) => ACTIVE_ASSET_STATUSES.includes(bucket.key))
    .reduce((sum, bucket) => sum + bucket.bookValue, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Asset Summary" />
        <SecondaryButton type="button" onClick={download} loading={exporting}>
          Export to Excel
        </SecondaryButton>
      </div>

      <FormError message={error} />

      {isError && (
        <QueryError
          error={loadError}
          fallback={MESSAGES.assetsLoadFailed}
          onRetry={refetch}
        />
      )}

      {data && (
        <dl className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Assets in service
            </dt>
            <dd className="mt-0.5 text-lg text-gray-900">
              {activeCount.toLocaleString('en-IN')}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Value now
            </dt>
            <dd className="mt-0.5 text-lg text-gray-900">
              {formatRupees(activeValue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Original cost
            </dt>
            <dd className="mt-0.5 text-lg text-gray-900">
              {formatRupees(data.totals.purchaseCost)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Scrapped
            </dt>
            <dd className="mt-0.5 text-lg text-gray-900">
              {(scrapped?.count ?? 0).toLocaleString('en-IN')}
            </dd>
          </div>
        </dl>
      )}

      <div className="flex gap-2">
        {(
          [
            ['category', 'By category'],
            ['project', 'By project'],
            ['status', 'By status'],
          ] as [Grouping, string][]
        ).map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGrouping(id)}
            aria-current={grouping === id ? 'true' : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
              grouping === id
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <ResponsiveList
        columns={columns}
        rows={buckets}
        rowKey={(bucket) => bucket.key}
        isLoading={isPending}
        emptyMessage="Nothing registered yet."
      />

      {data && (
        <p className="text-xs text-gray-500">
          As at {dateLabel(data.asOf)}. {data.totals.count.toLocaleString('en-IN')}{' '}
          assets on the register in total, including scrapped ones.
        </p>
      )}
    </div>
  );
}
