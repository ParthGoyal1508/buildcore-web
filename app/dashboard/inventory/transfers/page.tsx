'use client';

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  deleteTransfer,
  downloadStoreDocument,
  getTransfers,
  updateTransferStatus,
  type Transfer,
} from '@/app/lib/api/inventory';
import {
  MESSAGES,
  TRANSFER_NEXT_STATUSES,
  TRANSFER_STATUSES,
  inventoryLabel,
  type TransferStatus,
} from '@/app/lib/constants';
import { dateLabel, quantity as formatQuantity } from '@/app/lib/format';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  searchItems,
  searchSites,
} from '@/app/ui/inventory/inventory-search';
import Pager from '@/app/ui/inventory/pager';
import StoreDocumentDownload from '@/app/ui/inventory/store-document-download';
import TransferModal from '@/app/ui/inventory/transfer-modal';
import TransferReceiveModal from '@/app/ui/inventory/transfer-receive-modal';
import PageHeader from '@/app/ui/page-header';
import { RowAction, SelectField, TextField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';
import { useToast } from '@/app/ui/toast';

/**
 * 036 M3, M5, M12 (2026-10-17):
 * - Filters (from store, to store, item, status, date range) live in the URL, so Back from a slip
 *   download keeps them and a filtered list can be sent as a link. The stores and item are server
 *   searches — the old 200-row dropdowns could not filter by the 201st.
 * - A status change is confirmed, and only the row being changed shows as busy: one shared
 *   mutation state used to disable every row's buttons while one request ran.
 * - A short receipt shows its reason under the quantity.
 */
function TransfersPageBody() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();

  const [filters, setFilters, query] = useUrlState(
    {
      from: urlString(),
      to: urlString(),
      item: urlString(),
      status: urlString(),
      dateFrom: urlString(),
      dateTo: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );
  const [showModal, setShowModal] = useState(false);
  const [receiving, setReceiving] = useState<Transfer | null>(null);
  // Row ids with a request in flight, so each row's buttons show their own progress.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const rangeError =
    query.dateFrom && query.dateTo && query.dateFrom > query.dateTo
      ? 'From must be on or before To.'
      : undefined;

  const params = {
    page: query.page,
    fromSiteId: query.from || undefined,
    toSiteId: query.to || undefined,
    itemId: query.item || undefined,
    status: query.status || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
  };

  const list = useQuery({
    queryKey: ['inventory', 'transfers', companyId, params],
    queryFn: () => getTransfers(params),
    // A From after To is a typo, not a filter: hold the last good list until it is fixed.
    enabled: !rangeError,
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.transfers ?? [];

  const run = async (
    id: string,
    action: () => Promise<unknown>,
    done: string,
    failed: string,
  ) => {
    setBusy((current) => new Set(current).add(id));
    try {
      await action();
      toast.success(done);
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err) {
      toast.error(errorMessage(err, failed));
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const advance = async (row: Transfer, next: TransferStatus) => {
    const ok = await confirmDialog({
      title: `Mark ${inventoryLabel(next).toLowerCase()}?`,
      message: `${row.transferNo ? `${row.transferNo}: ` : ''}${formatQuantity(row.quantity)} ${row.unit} of ${row.itemName} from ${row.fromSiteName} to ${row.toSiteName}.`,
      confirmLabel: `Mark ${inventoryLabel(next).toLowerCase()}`,
    });
    if (!ok) return;
    await run(
      row.id,
      () => updateTransferStatus(row.id, next),
      `Transfer marked ${inventoryLabel(next).toLowerCase()}`,
      'Could not update this transfer.',
    );
  };

  const remove = async (row: Transfer) => {
    const ok = await confirmDialog({
      title: 'Delete this transfer?',
      message: MESSAGES.confirmDeleteTransfer,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await run(
      row.id,
      () => deleteTransfer(row.id),
      'Transfer deleted',
      'Could not delete this transfer.',
    );
  };

  // The picker shows a chosen filter's name from the rows it matched; a URL opened cold with no
  // matching rows shows the box empty but still filters.
  const fromOption = rows.find((row) => row.fromSiteId === query.from);
  const toOption = rows.find((row) => row.toSiteId === query.to);
  const itemOption = rows.find((row) => row.itemId === query.item);

  const columns: Column<Transfer>[] = [
    {
      key: 'number',
      header: 'Transfer / Challan',
      // Both series began on 2026-10-15; older transfers have neither.
      render: (row) =>
        row.transferNo || row.challanNo ? (
          <span className="whitespace-nowrap font-mono">
            {row.transferNo ?? '—'}
            <span className="block text-xs text-gray-500">
              {row.challanNo ?? '—'}
            </span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'date',
      header: 'Date',
      // Kept on one line: a narrow column broke the date at its hyphen.
      render: (row) => (
        <span className="whitespace-nowrap">{dateLabel(row.date)}</span>
      ),
    },
    { key: 'from', header: 'From', render: (row) => row.fromSiteName },
    { key: 'to', header: 'To', render: (row) => row.toSiteName },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    {
      key: 'quantity',
      header: 'Qty',
      className: 'text-right tabular-nums',
      sortValue: (row) => row.quantity,
      // What arrived, under what was sent, only when the two differ — and why (036 M3).
      render: (row) =>
        row.receivedQuantity !== null &&
        row.receivedQuantity !== undefined &&
        row.receivedQuantity !== row.quantity ? (
          <span>
            {formatQuantity(row.quantity)}
            <span className="block text-xs text-amber-700">
              {formatQuantity(row.receivedQuantity)} received
            </span>
            {row.shortageReason && (
              <span className="block max-w-[16rem] whitespace-normal text-left text-xs text-gray-600">
                {row.shortageReason}
              </span>
            )}
          </span>
        ) : (
          formatQuantity(row.quantity)
        ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      hideOnCard: true,
      render: (row) => row.vehicleNo ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={inventoryLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Transfers" />
        <Button type="button" onClick={() => setShowModal(true)}>
          New transfer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="transfers-from" className="font-medium text-gray-700">
            From store
          </label>
          <AsyncSelect
            id="transfers-from"
            value={filters.from}
            onChange={(id) => setFilters({ from: id })}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={
              fromOption
                ? { id: fromOption.fromSiteId, label: fromOption.fromSiteName }
                : null
            }
            emptyLabel="All stores"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="transfers-to" className="font-medium text-gray-700">
            To store
          </label>
          <AsyncSelect
            id="transfers-to"
            value={filters.to}
            onChange={(id) => setFilters({ to: id })}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={
              toOption
                ? { id: toOption.toSiteId, label: toOption.toSiteName }
                : null
            }
            emptyLabel="All stores"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="transfers-item" className="font-medium text-gray-700">
            Item
          </label>
          <AsyncSelect
            id="transfers-item"
            value={filters.item}
            onChange={(id) => setFilters({ item: id })}
            search={searchItems}
            cacheKey={['inventory', 'items', 'search', companyId]}
            selectedOption={
              itemOption
                ? {
                    id: itemOption.itemId,
                    label: itemOption.itemName,
                    sublabel: itemOption.itemCode,
                  }
                : null
            }
            emptyLabel="All items"
          />
        </div>

        <SelectField
          id="transfers-status"
          label="Status"
          value={filters.status}
          onChange={(event) => setFilters({ status: event.target.value })}
        >
          <option value="">Any status</option>
          {TRANSFER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {inventoryLabel(value)}
            </option>
          ))}
        </SelectField>

        <TextField
          id="transfers-date-from"
          label="From date"
          type="date"
          max={filters.dateTo || undefined}
          value={filters.dateFrom}
          onChange={(event) => setFilters({ dateFrom: event.target.value })}
          error={rangeError}
        />
        <TextField
          id="transfers-date-to"
          label="To date"
          type="date"
          min={filters.dateFrom || undefined}
          value={filters.dateTo}
          onChange={(event) => setFilters({ dateTo: event.target.value })}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={list.isPending && !rangeError}
        error={list.error}
        onRetry={list.refetch}
        serverPaged
        isRefreshing={list.isPlaceholderData}
        emptyMessage={MESSAGES.transfersEmpty}
        actions={(row) => (
          // One line on desktop, right-aligned like every other row: wrapping put an In Transit
          // row's four actions on two ragged lines. Cards still wrap.
          <div className="flex flex-wrap justify-end gap-2 md:flex-nowrap">
            <StoreDocumentDownload
              label="Slip"
              fallbackName={`Stock transfer slip ${row.transferNo ?? row.date.slice(0, 10)}`}
              load={(format) =>
                downloadStoreDocument('transfer-slip', row.id, format)
              }
              onError={(message) => toast.error(message)}
            />
            <StoreDocumentDownload
              label="Challan"
              fallbackName={`Delivery challan ${row.challanNo ?? row.date.slice(0, 10)}`}
              load={(format) =>
                downloadStoreDocument('challan', row.id, format)
              }
              onError={(message) => toast.error(message)}
            />
            {/* Only the transitions the backend will accept. Offering the rest
                would be offering a 409. */}
            {TRANSFER_NEXT_STATUSES[row.status].map((next) => (
              <RowAction
                key={next}
                // Received asks what arrived (2026-10-15); the other steps are confirmed.
                onClick={() =>
                  next === 'received' ? setReceiving(row) : void advance(row, next)
                }
                loading={busy.has(row.id)}
              >
                Mark {inventoryLabel(next).toLowerCase()}
              </RowAction>
            ))}
            <RowAction
              onClick={() => void remove(row)}
              // A received transfer is at the other store now; the backend refuses
              // to unwind it, and the control says so rather than finding out.
              disabled={row.status === 'received' || busy.has(row.id)}
              title={
                row.status === 'received'
                  ? 'A received transfer can no longer be deleted.'
                  : undefined
              }
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
        noun="transfer"
      />

      {showModal && <TransferModal onClose={() => setShowModal(false)} />}
      {receiving && (
        <TransferReceiveModal
          transfer={receiving}
          onClose={() => setReceiving(null)}
        />
      )}
    </div>
  );
}

export default function TransfersPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Transfer / Challan', 'Date', 'From', 'To', 'Item', 'Qty', 'Status']}
          rows={8}
        />
      }
    >
      <TransfersPageBody />
    </Suspense>
  );
}
