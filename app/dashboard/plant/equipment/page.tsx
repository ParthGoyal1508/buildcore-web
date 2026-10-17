'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  PLANT_OWNERSHIPS,
  downloadEquipmentRegister,
  getEquipment,
  type Equipment,
} from '@/app/lib/api/plant';
import { saveBlob } from '@/app/lib/download-file';
import {
  DISPOSED_EQUIPMENT_STATUSES,
  EQUIPMENT_STATUSES,
  MESSAGES,
  ROUTES,
  formatReading,
  plantLabel,
} from '@/app/lib/constants';
import CategoryOptions from '@/app/ui/plant/category-options';
import EquipmentImportModal from '@/app/ui/plant/equipment-import-modal';
import EquipmentModal from '@/app/ui/plant/equipment-modal';
import DisposeModal from '@/app/ui/plant/dispose-modal';
import { getCurrentUser } from '@/app/lib/api/users';
import Pager from '@/app/ui/inventory/pager';
import {
  usePlantCategories,
  usePlantSites,
  usePlantCompanyId,
} from '@/app/ui/plant/use-plant-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

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
  const [showImport, setShowImport] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // 2026-10-17: retiring a machine — Super Admin's (`MACHINERY_DISPOSE`).
  const [disposing, setDisposing] = useState<Equipment | null>(null);
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const canDispose =
    user.data?.permissions.includes('MACHINERY_DISPOSE') ?? false;

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

  /**
   * The client's "Vehicle Details (As on …)" sheet for what the filters show (2026-10-15).
   * The search box is left out: the sheet is the register by category, site, status and
   * ownership, and a half-typed name would quietly shorten it.
   */
  async function downloadRegister(format: 'pdf' | 'xlsx') {
    setDownloading(format);
    setDownloadError(null);
    try {
      const { blob, filename } = await downloadEquipmentRegister(format, {
        ...(companyId ? { companyId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(siteId ? { siteId } : {}),
        ...(status ? { status } : {}),
        ...(ownership ? { ownership } : {}),
      });
      saveBlob(blob, filename);
    } catch (err) {
      setDownloadError(
        err instanceof ApiError
          ? err.message
          : 'Could not download the register.',
      );
    } finally {
      setDownloading(null);
    }
  }

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
      // The registration number under the code (2026-10-15): the vehicle number is what the
      // yard calls a vehicle by, and its own column pushed Status off a laptop screen.
      render: (row) => (
        <span>
          <Link
            href={ROUTES.plantEquipmentDetail(row.id)}
            className="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {row.code}
          </Link>
          {row.registrationNo && (
            <span className="block whitespace-nowrap text-xs text-gray-500">
              {row.registrationNo}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      // Make and model under the name (2026-10-15): together they say what the machine is,
      // and a column each would push the register off a laptop screen.
      render: (row) => {
        const makeModel = [row.make, row.model].filter(Boolean).join(' ');
        return (
          <span>
            {row.name}
            {makeModel && (
              <span className="block text-xs text-gray-500">{makeModel}</span>
            )}
          </span>
        );
      },
    },
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
        row.ownership === 'owned'
          ? 'Owned'
          : row.vendorName
            ? `${plantLabel(row.ownership)} — ${row.vendorName}`
            : row.ownership === 'hired'
              ? 'Hired — unknown vendor'
              : plantLabel(row.ownership),
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
      // machine to find out what. It includes the registration papers lapsing within 30
      // days (2026-10-15), which the API folds in.
      render: (row) => {
        const alerts = row.alertDocumentTypes;
        return alerts.length > 0 ? (
          <span
            className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800"
            title={alerts.join(', ')}
          >
            {alerts.join(', ')}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Asset Register" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Download register</span>
          <SecondaryButton
            type="button"
            disabled={downloading !== null}
            onClick={() => void downloadRegister('pdf')}
          >
            {downloading === 'pdf' ? 'PDF…' : 'PDF'}
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={downloading !== null}
            onClick={() => void downloadRegister('xlsx')}
          >
            {downloading === 'xlsx' ? 'Excel…' : 'Excel'}
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setShowImport(true)}>
            Import master list
          </SecondaryButton>
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
      </div>

      <FormError message={downloadError} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          id="equipment-search"
          label="Search"
          placeholder="Code, name or registration no."
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
          <CategoryOptions categories={categories.data ?? []} />
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
          <option value="">Any ownership</option>
          {PLANT_OWNERSHIPS.map((value) => (
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
        actions={(row) => {
          const disposed = (DISPOSED_EQUIPMENT_STATUSES as readonly string[]).includes(
            row.status,
          );
          return (
            <>
              {!disposed && (
                <RowAction
                  onClick={() => {
                    setEditing(row);
                    setShowModal(true);
                  }}
                >
                  Edit
                </RowAction>
              )}
              {canDispose && !disposed && (
                <RowAction onClick={() => setDisposing(row)}>Dispose</RowAction>
              )}
            </>
          );
        }}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="machine"
      />

      {disposing && (
        <DisposeModal
          equipment={disposing}
          initialType="scrapped"
          onClose={() => setDisposing(null)}
          onDone={() => setDisposing(null)}
        />
      )}

      {showImport && (
        <EquipmentImportModal onClose={() => setShowImport(false)} />
      )}

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
