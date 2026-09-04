'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  getMaintenanceJobs,
  type MaintenanceJob,
} from '@/app/lib/api/plant';
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
  MESSAGES,
  plantLabel,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import JobPartsPanel from '@/app/ui/plant/job-parts-panel';
import {
  CloseJobModal,
  OpenJobModal,
} from '@/app/ui/plant/maintenance-modal';
import ServiceBillPanel from '@/app/ui/plant/service-bill-panel';
import {
  usePlantEquipment,
  usePlantCompanyId,
} from '@/app/ui/plant/use-plant-refs';
import {
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function MaintenancePage() {
  const equipment = usePlantEquipment();

  const searchParams = useSearchParams();
  // Seeded from the URL so the machine detail page can link straight to this list
  // already filtered. Read once as the initial value rather than kept in sync: the
  // dropdown below owns the filter after first render, and re-syncing would fight
  // a user who changed it.
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipmentId') ?? '',
  );
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [showOpen, setShowOpen] = useState(false);
  const [closing, setClosing] = useState<MaintenanceJob | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const companyId = usePlantCompanyId();

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'maintenance', filters],
    queryFn: () => getMaintenanceJobs(filters),
  });

  // Read back out of the freshly-fetched page rather than held in state, so the
  // panel's totals move as soon as a part is consumed or a bill is verified.
  const selected =
    data?.items.find((row) => row.id === selectedId) ?? null;

  const columns: Column<MaintenanceJob>[] = [
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    { key: 'type', header: 'Type', render: (row) => plantLabel(row.type) },
    {
      key: 'description',
      header: 'Work',
      hideOnCard: true,
      render: (row) => row.description,
    },
    {
      key: 'opened',
      header: 'Opened',
      render: (row) => row.openedAt.slice(0, 10),
    },
    {
      key: 'parts',
      header: 'Parts',
      hideOnCard: true,
      render: (row) => formatRupees(row.partsCost),
    },
    {
      key: 'labour',
      header: 'Labour',
      hideOnCard: true,
      render: (row) =>
        row.labourCost === null ? '—' : formatRupees(row.labourCost),
    },
    {
      key: 'bills',
      header: 'Service bills',
      hideOnCard: true,
      render: (row) => formatRupees(row.serviceBillCost),
    },
    {
      key: 'total',
      header: 'Total',
      // Parts + internal labour + verified service bills, computed on read so it
      // cannot lag a part consumed after the job was last saved.
      render: (row) => formatRupees(row.totalCost),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={plantLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Maintenance</h1>
        <SecondaryButton type="button" onClick={() => setShowOpen(true)}>
          Open a job
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="maintenance-filter-equipment"
          label="Machine"
          value={equipmentId}
          onChange={(event) => {
            setEquipmentId(event.target.value);
            // Back to the first page: narrowing the list while on page three
            // would show an empty screen for a filter that matches.
            setPage(1);
          }}
        >
          <option value="">All machines</option>
          {(equipment.data ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="maintenance-filter-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Open and closed</option>
          {MAINTENANCE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="maintenance-filter-type"
          label="Type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any type</option>
          {MAINTENANCE_TYPES.map((value) => (
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
        emptyMessage={MESSAGES.plantMaintenanceEmpty}
        actions={(row) => (
          <>
            <RowAction
              aria-expanded={selectedId === row.id}
              onClick={() =>
                setSelectedId(selectedId === row.id ? null : row.id)
              }
            >
              {selectedId === row.id ? 'Hide detail' : 'Parts & bills'}
            </RowAction>
            {row.status === 'open' && (
              <RowAction onClick={() => setClosing(row)}>Close</RowAction>
            )}
          </>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="job"
      />

      {selected && (
        <section className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {selected.equipmentCode} · {selected.description}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {formatRupees(selected.partsCost)} in parts ·{' '}
              {selected.labourCost === null
                ? 'no'
                : formatRupees(selected.labourCost)}{' '}
              labour · {formatRupees(selected.serviceBillCost)} in verified
              service bills · {formatRupees(selected.totalCost)} total
            </p>
          </div>
          <JobPartsPanel job={selected} />
          <ServiceBillPanel job={selected} />
        </section>
      )}

      {showOpen && <OpenJobModal onClose={() => setShowOpen(false)} />}
      {closing && (
        <CloseJobModal job={closing} onClose={() => setClosing(null)} />
      )}
    </div>
  );
}
