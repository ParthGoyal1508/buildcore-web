'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  deleteLogbookEntry,
  downloadLogbookExport,
  getEquipmentDetail,
  getLogbook,
  type LogbookEntry,
} from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, quantity3, todayIso } from '@/app/lib/format';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import { confirmDialog } from '@/app/ui/dialogs';
import Pager from '@/app/ui/inventory/pager';
import PageHeader from '@/app/ui/page-header';
import CorrectReadingsModal from '@/app/ui/plant/correct-readings-modal';
import LogbookModal from '@/app/ui/plant/logbook-modal';
import LogbookViews from '@/app/ui/plant/logbook-views';
import { EquipmentPicker, equipmentOption } from '@/app/ui/plant/pickers';
import {
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { useToast } from '@/app/ui/toast';

/**
 * The daily logbook entries.
 *
 * 036: filters live in the URL (the machine page links here filtered, Back keeps them, a filtered
 * list can be sent as a link); the machine filter is a server-searched picker; readings and fuel
 * are formatted with units; the filtered list downloads as Excel (K16); a read day can be
 * corrected with a reason (K6) instead of only deleted.
 */
export default function LogbookPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filters, setFilters, query] = useUrlState(
    {
      equipmentId: urlString(),
      dateFrom: urlString(),
      dateTo: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );
  const [showModal, setShowModal] = useState(false);
  const [correcting, setCorrecting] = useState<LogbookEntry | null>(null);
  const [exporting, setExporting] = useState(false);

  const filterQuery = {
    ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
    ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
    ...(query.dateTo ? { dateTo: query.dateTo } : {}),
  };
  const listQuery = { ...filterQuery, page: query.page };

  const list = useQuery({
    queryKey: ['plant', 'logbook', listQuery],
    queryFn: () => getLogbook(listQuery),
    placeholderData: keepPreviousData,
  });

  // The filtered machine, named for the picker and used for the units.
  const machine = useQuery({
    queryKey: ['plant', 'equipment', query.equipmentId],
    queryFn: () => getEquipmentDetail(query.equipmentId),
    enabled: Boolean(query.equipmentId),
  });
  const unitOf = (row: LogbookEntry) =>
    machine.data?.id === row.equipmentId && machine.data.meterType === 'km'
      ? 'km'
      : 'h';

  const remove = useMutation({
    mutationFn: (id: string) => deleteLogbookEntry(id),
    onSuccess: () => {
      toast.success('Logbook entry deleted.');
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not delete this entry.')),
  });

  async function exportList() {
    setExporting(true);
    try {
      const { blob, filename } = await downloadLogbookExport(filterQuery);
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the logbook.'));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<LogbookEntry>[] = [
    { key: 'date', header: 'Date', render: (row) => dateLabel(row.date) },
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    {
      key: 'opening',
      header: 'Opening',
      hideOnCard: true,
      className: 'text-right tabular-nums',
      render: (row) => quantity3(row.openingReading),
    },
    {
      key: 'closing',
      header: 'Closing',
      hideOnCard: true,
      className: 'text-right tabular-nums',
      render: (row) => quantity3(row.closingReading),
    },
    {
      key: 'hours',
      header: 'Run',
      className: 'text-right tabular-nums',
      render: (row) => `${quantity3(row.totalHours)} ${unitOf(row)}`,
    },
    {
      key: 'fuel',
      header: 'Fuel',
      className: 'text-right tabular-nums',
      render: (row) =>
        row.fuelConsumed === null
          ? '—'
          : `${quantity3(row.fuelConsumed)} litres`,
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
      render: (row) =>
        row.readingGapReason
          ? `${row.remarks ? `${row.remarks} · ` : ''}Gap: ${row.readingGapReason}`
          : (row.remarks ?? '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Logbook" />
        <div className="flex flex-wrap items-center gap-3">
          <LogbookViews current="entries" />
          <SecondaryButton
            type="button"
            loading={exporting}
            onClick={() => void exportList()}
          >
            Excel
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setShowModal(true)}>
            Record a day
          </SecondaryButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <EquipmentPicker
          id="logbook-filter-equipment"
          label="Machine"
          emptyLabel="All machines"
          value={filters.equipmentId}
          selectedOption={machine.data ? equipmentOption(machine.data) : null}
          onChange={(id) => setFilters({ equipmentId: id })}
        />
        <TextField
          id="logbook-filter-from"
          label="From"
          type="date"
          max={filters.dateTo || todayIso()}
          value={filters.dateFrom}
          onChange={(event) => setFilters({ dateFrom: event.target.value })}
        />
        <TextField
          id="logbook-filter-to"
          label="To"
          type="date"
          min={filters.dateFrom || undefined}
          value={filters.dateTo}
          onChange={(event) => setFilters({ dateTo: event.target.value })}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isPending}
        isRefreshing={list.isFetching && !list.isPending}
        error={list.isError ? list.error : undefined}
        onRetry={list.refetch}
        serverPaged
        emptyMessage={MESSAGES.plantLogbookEmpty}
        actions={(row) => (
          <div className="flex flex-wrap justify-end gap-1">
            <RowAction onClick={() => setCorrecting(row)}>
              Correct readings
            </RowAction>
            <RowAction
              loading={remove.isPending && remove.variables === row.id}
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Delete this logbook entry?',
                    message: MESSAGES.plantConfirmDeleteLogbook,
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
          </div>
        )}
      />

      <Pager
        total={list.data?.total ?? 0}
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="entry"
        plural="entries"
      />

      {showModal && <LogbookModal onClose={() => setShowModal(false)} />}
      {correcting && (
        <CorrectReadingsModal
          entry={correcting}
          meterType={unitOf(correcting) === 'km' ? 'km' : 'hours'}
          onClose={() => setCorrecting(null)}
        />
      )}
    </div>
  );
}
