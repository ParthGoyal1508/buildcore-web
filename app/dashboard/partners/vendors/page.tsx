'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  VendorDetail,
  VendorListItem,
  getVendor,
  getVendorCategories,
  getVendors,
  setVendorActive,
} from '@/app/lib/api/partners';
import {
  MESSAGES,
  ROUTES,
  VENDOR_TYPES,
  partnersLabel,
} from '@/app/lib/constants';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import Pager from '@/app/ui/inventory/pager';
import { RowAction } from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import VendorModal from '@/app/ui/partners/vendor-modal';
import PageHeader from '@/app/ui/page-header';
import { confirmDialog } from '@/app/ui/dialogs';
import { NocModal } from '@/app/ui/nocs/noc-panel';
import { NocStatusBadge, useNocStatuses } from '@/app/ui/nocs/noc-status';

const PAGE_SIZE = 25;

const ACTIVE_FILTERS = ['', 'true', 'false'] as const;

/**
 * Every query a vendor change makes stale (036 N3, 2026-10-17): this list and the vendor
 * detail under `['partners', 'vendors']`, and every inventory vendor picker, which all keep
 * their queries under `['inventory', 'vendors']`. A deactivated vendor could otherwise still
 * be picked on a purchase for the picker's 30 s stale time. The contractor lists too: a
 * deactivated vendor's contractor profile drops off them.
 */
function invalidateVendorQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['partners', 'vendors'] });
  queryClient.invalidateQueries({ queryKey: ['inventory', 'vendors'] });
  queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
}

function VendorsPageBody() {
  // Filters, search and page live in the URL (036 N3, A14): Back from a vendor returns to the
  // same page of the same filter, and a filtered list can be sent as a link. Search is debounced
  // (A15), and the previous page stays on screen while the next loads.
  const [filters, setFilters, query] = useUrlState(
    {
      q: urlString(),
      type: urlEnum(['', ...VENDOR_TYPES] as const, ''),
      active: urlEnum(ACTIVE_FILTERS, ''),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  // The vendor a NOC is being managed for (2026-10-15).
  const [nocFor, setNocFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VendorDetail | null>(null);
  // The row whose detail is being fetched for Edit, so its button shows it is working.
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const params = {
    search: query.q.trim() || undefined,
    type: query.type || undefined,
    active: query.active === '' ? undefined : query.active === 'true',
    page: query.page,
    pageSize: PAGE_SIZE,
  };

  const { data, isPending, error, refetch, isPlaceholderData, isFetching } =
    useQuery({
      queryKey: ['partners', 'vendors', params],
      queryFn: () => getVendors(params),
      placeholderData: keepPreviousData,
    });
  // Open until the vendor's NOC is uploaded, then closed (2026-10-17).
  const nocStatuses = useNocStatuses(
    'vendor',
    (data?.items ?? []).map((row) => row.id),
  );

  const { data: categories } = useQuery({
    queryKey: ['partners', 'vendor-categories'],
    queryFn: getVendorCategories,
  });
  const categoryName = (id: string) =>
    categories?.find((category) => category.id === id)?.name ?? id;

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setVendorActive(id, active),
    onSuccess: (saved) => {
      setActionError(null);
      invalidateVendorQueries(queryClient);
      toast.success(
        saved.active ? `${saved.name} reactivated.` : `${saved.name} deactivated.`,
      );
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, MESSAGES.saveFailed)),
  });

  async function openEdit(id: string) {
    if (openingId) return;
    setOpeningId(id);
    try {
      // The list row carries only what the list needs; the modal needs contacts,
      // hire terms and the full address, so it fetches the detail rather than
      // rendering a half-populated form.
      setEditing(await getVendor(id));
      setActionError(null);
      setModalOpen(true);
    } catch (err) {
      setActionError(errorMessage(err, MESSAGES.loadFailed));
    } finally {
      setOpeningId(null);
    }
  }

  const columns: Column<VendorListItem>[] = [
    {
      key: 'name',
      header: 'Vendor',
      sticky: true,
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">
            {row.code}
            {row.city ? ` · ${row.city}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <StatusBadge status={row.type} />,
    },
    {
      key: 'categories',
      header: 'Deals in',
      render: (row) =>
        row.categoryIds.length === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className="text-sm">
            {row.categoryIds.map(categoryName).join(', ')}
          </span>
        ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (row) =>
        row.primaryContact ? (
          <div>
            <p>{row.primaryContact.name}</p>
            {row.primaryContact.phone && (
              <p className="text-xs text-gray-500">
                {row.primaryContact.phone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (row) => row.gstin ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.active ? 'active' : 'closed'} />
      ),
    },
    {
      key: 'noc',
      header: 'NOC',
      sortValue: (row) => nocStatuses?.get(row.id)?.status ?? '',
      render: (row) => <NocStatusBadge status={nocStatuses?.get(row.id)} />,
    },
  ];

  const total = data?.total ?? 0;

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Vendors"
          description="Suppliers, hirers and subcontractors. Vendor codes are allocated by the company series and cannot be edited."
        />
        <div className="flex gap-2">
          <Link
            href={ROUTES.partnersVendorCategories}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            Manage categories
          </Link>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Add vendor
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field id="vendor-search" label="Search">
          <TextInput
            id="vendor-search"
            placeholder="Name, code or GSTIN"
            value={filters.q}
            onChange={(event) => setFilters({ q: event.target.value })}
          />
        </Field>
        <Field id="vendor-type-filter" label="Type">
          <SelectInput
            id="vendor-type-filter"
            value={filters.type}
            onChange={(event) =>
              setFilters({ type: event.target.value as typeof filters.type })
            }
          >
            <option value="">All types</option>
            {VENDOR_TYPES.map((value) => (
              <option key={value} value={value}>
                {partnersLabel(value)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="vendor-active-filter" label="Status">
          <SelectInput
            id="vendor-active-filter"
            value={filters.active}
            onChange={(event) =>
              setFilters({ active: event.target.value as typeof filters.active })
            }
          >
            <option value="">Active and inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </SelectInput>
        </Field>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={8}
        // Sorting the loaded 25 rows of a paged list would misrepresent the list (A13).
        serverPaged
        isRefreshing={isPlaceholderData && isFetching}
        emptyMessage={
          filters.q || filters.type || filters.active
            ? 'No vendors match these filters.'
            : 'No vendors yet. Add the first with “Add vendor”.'
        }
        actions={(row) => (
          <>
            <RowAction
              type="button"
              intent="read"
              onClick={() => setNocFor({ id: row.id, name: row.name })}
            >
              NOC
            </RowAction>
            <RowAction
              type="button"
              loading={openingId === row.id}
              disabled={openingId !== null && openingId !== row.id}
              onClick={() => openEdit(row.id)}
            >
              Edit
            </RowAction>
            <RowAction
              type="button"
              loading={
                toggleActive.isPending && toggleActive.variables?.id === row.id
              }
              disabled={toggleActive.isPending}
              onClick={async () => {
                // Deactivating removes the vendor from every picker and drops its
                // contractor off the compliance screens, so it is confirmed rather
                // than being a one-click toggle in a dense table (FR-010).
                const next = !row.active;
                const message = next
                  ? `Reactivate ${row.name}?`
                  : `Deactivate ${row.name}? They will stop appearing in pickers, and any contractor profile drops off the compliance lists.`;
                if (
                  await confirmDialog({
                    title: next
                      ? 'Reactivate this vendor?'
                      : 'Deactivate this vendor?',
                    message,
                    confirmLabel: next ? 'Reactivate' : 'Deactivate',
                    tone: next ? 'default' : 'danger',
                  })
                ) {
                  toggleActive.mutate({ id: row.id, active: next });
                }
              }}
            >
              {row.active ? 'Deactivate' : 'Reactivate'}
            </RowAction>
          </>
        )}
      />

      <div className="mt-4">
        <Pager
          total={total}
          page={query.page}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => setFilters({ page })}
          noun="vendor"
        />
      </div>

      {modalOpen && (
        <VendorModal vendor={editing} onClose={() => setModalOpen(false)} />
      )}

      {nocFor && (
        <NocModal
          subjectType="vendor"
          subjectId={nocFor.id}
          title={`NOC — ${nocFor.name}`}
          onClose={() => setNocFor(null)}
        />
      )}
    </main>
  );
}

export default function VendorsPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Vendor', 'Type', 'Deals in', 'Contact', 'GSTIN', 'Status']}
          rows={8}
        />
      }
    >
      <VendorsPageBody />
    </Suspense>
  );
}
