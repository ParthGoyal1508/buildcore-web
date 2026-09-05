'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { getAssets, type Asset } from '@/app/lib/api/assets';
import {
  ASSET_STATUSES,
  MESSAGES,
  ROUTES,
  assetsLabel,
  formatAssetQuantity,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import AssetModal from '@/app/ui/assets/asset-modal';
import {
  useAssetCategories,
  useAssetSites,
  useAssetsCompanyId,
} from '@/app/ui/assets/use-asset-refs';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import {
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function AssetRegisterPage() {
  const categories = useAssetCategories();
  const sites = useAssetSites();
  const companyId = useAssetsCompanyId();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(search ? { search } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(status ? { status } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['assets', 'register', filters],
    queryFn: () => getAssets(filters),
  });

  const hasFilters =
    search !== '' || categoryId !== '' || siteId !== '' || status !== '';

  const columns: Column<Asset>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <Link
          href={ROUTES.assetsAsset(row.id)}
          className="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {row.assetCode}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'category',
      header: 'Category',
      hideOnCard: true,
      render: (row) => row.categoryName,
    },
    {
      key: 'identity',
      header: 'Serial / Qty',
      // One column for the two tracking modes: a serialised asset has a serial and
      // no meaningful quantity, a bulk one the reverse, and two half-empty columns
      // would read as missing data on every row.
      render: (row) =>
        row.trackingMode === 'serialised'
          ? (row.serialNumber ?? '—')
          : formatAssetQuantity(row.quantity, row.unitOfMeasure),
    },
    { key: 'site', header: 'Site', render: (row) => row.siteName },
    {
      key: 'custodian',
      header: 'Custodian',
      render: (row) => row.custodianName ?? '—',
    },
    {
      key: 'condition',
      header: 'Condition',
      hideOnCard: true,
      render: (row) => row.conditionGradeName ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={assetsLabel(row.status)} />
      ),
    },
    {
      key: 'value',
      header: 'Book value',
      // Straight from the API and never recomputed here (spec FR-011): one figure,
      // one source, no schedule and no accounting vocabulary on a register screen.
      render: (row) => formatRupees(row.bookValue),
    },
    {
      key: 'flags',
      header: 'Attention',
      // Answered in the list itself, so nobody opens an asset to find out whether
      // anything needs doing to it.
      render: (row) => {
        const flags = [
          row.inspectionDue
            ? {
                key: 'inspection',
                text: 'Inspection due',
                title: `Due ${row.nextInspectionDue?.slice(0, 10)}`,
              }
            : null,
          // Names *which* paperwork: "something is expiring" sends someone to open
          // the asset to find out what.
          row.expiryAlert
            ? {
                key: 'documents',
                text: row.alertDocumentTypes.join(', '),
                title: row.alertDocumentTypes.join(', '),
              }
            : null,
        ].filter(Boolean) as { key: string; text: string; title: string }[];

        if (flags.length === 0) {
          return <span className="text-sm text-gray-400">—</span>;
        }
        return (
          <span className="flex flex-wrap gap-1">
            {flags.map((flag) => (
              <span
                key={flag.key}
                className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800"
                title={flag.title}
              >
                {flag.text}
              </span>
            ))}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Asset Register</h1>
        <SecondaryButton
          type="button"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          Register an asset
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="asset-search"
          label="Search"
          placeholder="Code, name or serial"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // Back to the first page: narrowing the list while on page three would
            // show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
        <SelectField
          id="asset-filter-category"
          label="Category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="asset-filter-site"
          label="Site"
          value={siteId}
          onChange={(event) => {
            setSiteId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All sites</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="asset-filter-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {ASSET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {assetsLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.assetsLoadFailed : undefined}
        emptyMessage={
          hasFilters ? MESSAGES.assetsEmptyFiltered : MESSAGES.assetsEmpty
        }
        actions={(row) => (
          <RowAction
            onClick={() => {
              setEditing(row);
              setShowModal(true);
            }}
          >
            Edit
          </RowAction>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="asset"
      />

      {showModal && (
        <AssetModal
          asset={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
