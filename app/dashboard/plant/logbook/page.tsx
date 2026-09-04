'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteLogbookEntry,
  getLogbook,
  type LogbookEntry,
} from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import LogbookModal from '@/app/ui/plant/logbook-modal';
import {
  usePlantEquipment,
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

export default function LogbookPage() {
  const queryClient = useQueryClient();
  const equipment = usePlantEquipment();

  const searchParams = useSearchParams();
  // Seeded from the URL so the machine detail page can link straight to this list
  // already filtered. Read once as the initial value rather than kept in sync: the
  // dropdown below owns the filter after first render, and re-syncing would fight
  // a user who changed it.
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipmentId') ?? '',
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = usePlantCompanyId();

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'logbook', filters],
    queryFn: () => getLogbook(filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLogbookEntry(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete this entry.',
      ),
  });

  const columns: Column<LogbookEntry>[] = [
    { key: 'date', header: 'Date', render: (row) => row.date.slice(0, 10) },
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    {
      key: 'opening',
      header: 'Opening',
      hideOnCard: true,
      render: (row) => row.openingReading,
    },
    {
      key: 'closing',
      header: 'Closing',
      hideOnCard: true,
      render: (row) => row.closingReading,
    },
    { key: 'hours', header: 'Hours run', render: (row) => row.totalHours },
    {
      key: 'fuel',
      header: 'Fuel',
      render: (row) => (row.fuelConsumed === null ? '—' : `${row.fuelConsumed} L`),
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (row) => row.operatorName ?? '—',
    },
    {
      key: 'remarks',
      header: 'Remarks',
      hideOnCard: true,
      render: (row) => row.remarks ?? '—',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Logbook</h1>
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          Record a day
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          id="logbook-filter-equipment"
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
        <TextField
          id="logbook-filter-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
        />
        <TextField
          id="logbook-filter-to"
          label="To"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage={MESSAGES.plantLogbookEmpty}
        actions={(row) => (
          <RowAction
            onClick={() => {
              if (window.confirm(MESSAGES.plantConfirmDeleteLogbook)) {
                remove.mutate(row.id);
              }
            }}
          >
            Delete
          </RowAction>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="entry"
        plural="entries"
      />

      {showModal && <LogbookModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
