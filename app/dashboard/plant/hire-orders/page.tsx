'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteHireOrder,
  downloadHireOrder,
  getHireOrders,
  type HireOrder,
} from '@/app/lib/api/plant-hire';
import { getProjects } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { confirmDialog } from '@/app/ui/dialogs';
import PageHeader from '@/app/ui/page-header';
import DocumentDownloads from '@/app/ui/plant/document-downloads';
import HireOrderModal from '@/app/ui/plant/hire-order-modal';
import {
  usePlantCompanyId,
  usePlantVendors,
} from '@/app/ui/plant/use-plant-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { NocModal } from '@/app/ui/nocs/noc-panel';

/**
 * Vehicle work/hire orders (2026-10-15), each downloadable in the client's WORK/HIRE ORDER
 * format. Hire bills are raised against these, which is why a billed order cannot be
 * deleted — the server refuses and its reason is shown as it stands.
 *
 * Not paginated: the API returns the company's orders whole, and a company raises a handful
 * a month.
 */
export default function HireOrdersPage() {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const vendors = usePlantVendors();
  const projects = useQuery({
    queryKey: ['plant', 'projects'],
    queryFn: () => getProjects({ pageSize: 200 }),
    select: (page) => page.items,
  });

  const [vendorId, setVendorId] = useState('');
  // The order a NOC is being managed for (2026-10-15).
  const [nocFor, setNocFor] = useState<{ id: string; code: string } | null>(
    null,
  );
  const [projectId, setProjectId] = useState('');
  const [editing, setEditing] = useState<HireOrder | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    ...(companyId ? { companyId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(projectId ? { projectId } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'hire-orders', filters],
    queryFn: () => getHireOrders(filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteHireOrder(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({
        queryKey: ['plant', 'hire-orders'],
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete that order.',
      ),
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
        <span className="whitespace-nowrap">{row.date.slice(0, 10)}</span>
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
      render: (row) => formatRupees(row.totalAmount),
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

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="ho-filter-vendor"
          label="Supplier"
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
        >
          <option value="">All suppliers</option>
          {(vendors.data ?? []).map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="ho-filter-project"
          label="Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">All projects</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </SelectField>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        // The whole row opens the order (2026-10-15).
        rowHref={(row) => `${ROUTES.plantHireOrders}/${row.id}`}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage="No work orders yet."
        actions={(row) => (
          // Wrapping, so the three downloads and the row's own actions fit a phone card —
          // the list's action strip does not wrap on its own (2026-10-15).
          <div className="flex flex-wrap justify-end gap-2">
            <DocumentDownloads
              load={(format) => downloadHireOrder(row, format)}
              onError={setError}
            />
            <RowAction
              intent="read"
              onClick={() => setNocFor({ id: row.id, code: row.code })}
            >
              NOC
            </RowAction>
            <RowAction onClick={() => setEditing(row)}>Edit</RowAction>
            <RowAction
              disabled={remove.isPending}
              onClick={async () => {
                const confirmed = await confirmDialog({
                  title: `Delete work order ${row.code}?`,
                  message:
                    'An order a hire bill has been raised against cannot be deleted.',
                  confirmLabel: 'Delete',
                });
                if (confirmed) remove.mutate(row.id);
              }}
            >
              Delete
            </RowAction>
          </div>
        )}
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
