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
  deleteHireOrder,
  downloadHireOrder,
  getHireOrdersPage,
  type HireOrder,
} from '@/app/lib/api/plant-hire';
import { ROUTES } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import { confirmDialog } from '@/app/ui/dialogs';
import Pager from '@/app/ui/inventory/pager';
import PageHeader from '@/app/ui/page-header';
import DocumentDownloads from '@/app/ui/plant/document-downloads';
import HireOrderModal from '@/app/ui/plant/hire-order-modal';
import { ProjectPicker, VendorPicker } from '@/app/ui/plant/pickers';
import { usePlantCompanyId } from '@/app/ui/plant/use-plant-refs';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { NocModal } from '@/app/ui/nocs/noc-panel';
import {
  filterByNoc,
  NocFilterField,
  NocStatusBadge,
  useNocStatuses,
  type NocFilter,
} from '@/app/ui/nocs/noc-status';
import { dateLabel } from '@/app/lib/format';

/**
 * Vehicle work/hire orders (2026-10-15), each downloadable in the client's WORK/HIRE ORDER
 * format. Hire bills are raised against these, which is why a billed order cannot be
 * deleted — the server refuses and its reason is shown as it stands.
 *
 * 036 K17: paged. The API used to return the orders whole and silently stopped at 200; it now
 * pages when asked, and this screen asks. Supplier and project are server-searched pickers, and
 * the filters and page live in the URL. (The NOC filter narrows the page shown.)
 */
export default function HireOrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = usePlantCompanyId();
  const [filters, setFilters, query] = useUrlState(
    { vendorId: urlString(), projectId: urlString(), page: urlNumber(1) },
    { resetPage: 'page' },
  );

  // The order a NOC is being managed for (2026-10-15).
  const [nocFor, setNocFor] = useState<{ id: string; code: string } | null>(
    null,
  );
  const [editing, setEditing] = useState<HireOrder | 'new' | null>(null);

  const listQuery = {
    ...(companyId ? { companyId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    page: query.page,
  };

  const list = useQuery({
    queryKey: ['plant', 'hire-orders', listQuery],
    queryFn: () => getHireOrdersPage(listQuery),
    placeholderData: keepPreviousData,
  });
  const data = list.data?.items;
  // Open until the order's NOC is uploaded, then closed (2026-10-17).
  const [nocFilter, setNocFilter] = useState<NocFilter>('');
  const nocStatuses = useNocStatuses(
    'hire_order',
    (data ?? []).map((row) => row.id),
  );

  const remove = useMutation({
    mutationFn: (id: string) => deleteHireOrder(id),
    onSuccess: () => {
      toast.success('Work order deleted.');
      void queryClient.invalidateQueries({
        queryKey: ['plant', 'hire-orders'],
      });
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not delete that order.')),
  });

  const columns: Column<HireOrder>[] = [
    {
      key: 'code',
      header: 'Order No.',
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-mono">{row.code}</span>
          {row.referenceNo && (
            <span className="text-xs text-gray-500">Ref {row.referenceNo}</span>
          )}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="whitespace-nowrap">{dateLabel(row.date)}</span>
      ),
    },
    { key: 'vendor', header: 'Supplier', render: (row) => row.vendorName },
    {
      key: 'project',
      header: 'Project',
      hideOnCard: true,
      render: (row) => (
        <span
          className="line-clamp-2 max-w-[14rem]"
          title={row.projectName ?? undefined}
        >
          {row.projectName ?? '—'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total incl. GST',
      render: (row) => rupees(row.totalAmount),
    },
    {
      key: 'noc',
      header: 'NOC',
      sortValue: (row) => nocStatuses?.get(row.id)?.status ?? '',
      render: (row) => <NocStatusBadge status={nocStatuses?.get(row.id)} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Hire Orders" />
        <SecondaryButton type="button" onClick={() => setEditing('new')}>
          New work order
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <VendorPicker
          id="ho-filter-vendor"
          label="Supplier"
          emptyLabel="All suppliers"
          value={filters.vendorId}
          onChange={(id) => setFilters({ vendorId: id })}
        />
        <ProjectPicker
          id="ho-filter-project"
          label="Project"
          emptyLabel="All projects"
          value={filters.projectId}
          onChange={(id) => setFilters({ projectId: id })}
        />
        <NocFilterField
          id="ho-filter-noc"
          value={nocFilter}
          onChange={setNocFilter}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={filterByNoc(data ?? [], nocFilter, nocStatuses, (row) => row.id)}
        rowKey={(row) => row.id}
        // The whole row opens the order (2026-10-15).
        rowHref={(row) => `${ROUTES.plantHireOrders}/${row.id}`}
        isLoading={list.isPending}
        isRefreshing={list.isFetching && !list.isPending}
        error={list.isError ? list.error : undefined}
        onRetry={list.refetch}
        serverPaged
        emptyMessage="No work orders yet."
        actions={(row) => (
          // Wrapping, so the three downloads and the row's own actions fit a phone card —
          // the list's action strip does not wrap on its own (2026-10-15).
          <div className="flex flex-wrap justify-end gap-2">
            <DocumentDownloads
              load={(format) => downloadHireOrder(row, format)}
              onError={(message) => toast.error(message)}
            />
            <RowAction
              intent="read"
              onClick={() => setNocFor({ id: row.id, code: row.code })}
            >
              NOC
            </RowAction>
            <RowAction onClick={() => setEditing(row)}>Edit</RowAction>
            <RowAction
              loading={remove.isPending && remove.variables === row.id}
              onClick={async () => {
                const confirmed = await confirmDialog({
                  title: `Delete work order ${row.code}?`,
                  message:
                    'An order a hire bill has been raised against cannot be deleted.',
                  confirmLabel: 'Delete',
                  tone: 'danger',
                });
                if (confirmed) remove.mutate(row.id);
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
        noun="order"
      />

      {nocFor && (
        <NocModal
          subjectType="hire_order"
          subjectId={nocFor.id}
          title={`NOC — work order ${nocFor.code}`}
          onClose={() => setNocFor(null)}
        />
      )}

      {editing && (
        <HireOrderModal
          order={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
