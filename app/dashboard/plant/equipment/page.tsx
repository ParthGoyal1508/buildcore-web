'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  getEquipment,
  type Equipment,
} from '@/app/lib/api/plant';
import {
  EQUIPMENT_OWNERSHIPS,
  EQUIPMENT_STATUSES,
  MESSAGES,
  ROUTES,
  formatReading,
  plantLabel,
} from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import EquipmentModal from '@/app/ui/plant/equipment-modal';
import Pager from '@/app/ui/inventory/pager';
import {
  usePlantCategories,
  usePlantSites,
  usePlantCompanyId,
} from '@/app/ui/plant/use-plant-refs';
import {
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function AssetRegisterPage() {
  const categories = usePlantCategories();
  const sites = usePlantSites();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('');
  const [ownership, setOwnership] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showModal, setShowModal] = useState(false);

  const companyId = usePlantCompanyId();

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(search ? { search } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(status ? { status } : {}),
    ...(ownership ? { ownership } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'equipment', filters],
    queryFn: () => getEquipment(filters),
  });

  const hasFilters =
    search !== '' ||
    categoryId !== '' ||
    siteId !== '' ||
    status !== '' ||
    ownership !== '';

  const columns: Column<Equipment>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <Link
          href={ROUTES.plantEquipmentDetail(row.id)}
          className="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {row.code}
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
      key: 'ownership',
      header: 'Ownership',
      render: (row) =>
        row.ownership === 'hired'
          ? `Hired — ${row.vendorName ?? 'unknown vendor'}`
          : 'Owned',
    },
    {
      key: 'site',
      header: 'Deployed at',
      render: (row) => row.siteName ?? '—',
    },
    {
      key: 'reading',
      header: 'Reading',
      render: (row) => formatReading(row.currentReading, row.meterType),
    },
    {
      key: 'utilisation',
      header: 'Utilisation',
      render: (row) => `${row.utilizationPercent}%`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={plantLabel(row.status)} />
      ),
    },
    {
      key: 'documents',
      header: 'Documents',
      // SC-001: the list answers this itself. `alertDocumentTypes` names *which*
      // paperwork, because "something is expiring" sends someone to open the
      // machine to find out what.
      render: (row) =>
        row.expiryAlert ? (
          <span
            className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800"
            title={row.alertDocumentTypes.join(', ')}
          >
            {row.alertDocumentTypes.join(', ')}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
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
          Register a machine
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          id="equipment-search"
          label="Search"
          placeholder="Code or name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // Back to the first page: narrowing the list while on page three
            // would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
        <SelectField
          id="equipment-filter-category"
          label="Category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="equipment-filter-site"
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
          id="equipment-filter-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {EQUIPMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="equipment-filter-ownership"
          label="Ownership"
          value={ownership}
          onChange={(event) => {
            setOwnership(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Owned and hired</option>
          {EQUIPMENT_OWNERSHIPS.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage={
          hasFilters
            ? MESSAGES.plantEquipmentEmptyFiltered
            : MESSAGES.plantEquipmentEmpty
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
        noun="machine"
      />

      {showModal && (
        <EquipmentModal
          equipment={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
