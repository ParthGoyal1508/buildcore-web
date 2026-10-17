'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getEquipmentDetail,
  deleteServiceSchedule,
  getServiceSchedules,
  type ServiceSchedule,
} from '@/app/lib/api/plant';
import {
  MESSAGES,
  SERVICE_SCHEDULE_STATUSES,
  plantLabel,
} from '@/app/lib/constants';
import Pager from '@/app/ui/inventory/pager';
import { EquipmentPicker, equipmentOption } from '@/app/ui/plant/pickers';
import ServiceScheduleModal from '@/app/ui/plant/service-schedule-modal';
import {
  usePlantCompanyId,
} from '@/app/ui/plant/use-plant-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';
import { confirmDialog } from '@/app/ui/dialogs';

export default function ServiceSchedulesPage() {
  const queryClient = useQueryClient();
  // 036 K15: the filter is a server-searched picker; the chosen machine is named from its record.

  const searchParams = useSearchParams();
  // Seeded from the URL so the machine detail page can link straight to this list
  // already filtered. Read once as the initial value rather than kept in sync: the
  // dropdown below owns the filter after first render, and re-syncing would fight
  // a user who changed it.
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipmentId') ?? '',
  );
  const filterMachine = useQuery({
    queryKey: ['plant', 'equipment', equipmentId],
    queryFn: () => getEquipmentDetail(equipmentId),
    enabled: Boolean(equipmentId),
  });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ServiceSchedule | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = usePlantCompanyId();

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(status ? { status } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'services', filters],
    queryFn: () => getServiceSchedules(filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteServiceSchedule(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not delete this schedule.',
      ),
  });

  const columns: Column<ServiceSchedule>[] = [
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    { key: 'type', header: 'Service', render: (row) => row.serviceType },
    {
      key: 'interval',
      header: 'Interval',
      hideOnCard: true,
      render: (row) =>
        row.intervalHours !== null
          ? `${row.intervalHours} hrs`
          : row.intervalKm !== null
            ? `${row.intervalKm} km`
            : '—',
    },
    {
      key: 'lastDone',
      header: 'Last done',
      hideOnCard: true,
      render: (row) => row.lastDoneReading,
    },
    { key: 'nextDue', header: 'Next due', render: (row) => row.nextDueReading },
    {
      key: 'current',
      header: 'Now at',
      render: (row) => row.currentReading,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      // Negative when the machine has already run past its due reading, which is
      // more useful than an unsigned figure that hides which side of due it is on.
      render: (row) =>
        row.readingsRemaining < 0
          ? `${Math.abs(row.readingsRemaining)} over`
          : row.readingsRemaining,
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
        <PageHeader title="Service Schedules" />
        <SecondaryButton
          type="button"
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          Add a schedule
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <EquipmentPicker
          id="services-filter-equipment"
          label="Machine"
          emptyLabel="All machines"
          value={equipmentId}
          selectedOption={
            filterMachine.data ? equipmentOption(filterMachine.data) : null
          }
          onChange={(id) => {
            setEquipmentId(id);
            // Back to the first page: narrowing the list while on page three
            // would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
        <SelectField
          id="services-filter-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {SERVICE_SCHEDULE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage={MESSAGES.plantServicesEmpty}
        actions={(row) => (
          <>
            <RowAction
              onClick={() => {
                setEditing(row);
                setShowModal(true);
              }}
            >
              Edit
            </RowAction>
            <RowAction
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Delete this service schedule?',
                    message: 'Delete this service schedule?',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                ) {
                  remove.mutate(row.id);
                }
              }}
            >
              Delete
            </RowAction>
          </>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="schedule"
      />

      {showModal && (
        <ServiceScheduleModal
          schedule={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
