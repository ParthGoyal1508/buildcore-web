'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
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
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import VendorModal from '@/app/ui/partners/vendor-modal';

const PAGE_SIZE = 25;

export default function VendorsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VendorDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const params = {
    search: search || undefined,
    type: type || undefined,
    active: activeFilter === '' ? undefined : activeFilter === 'true',
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'vendors', params],
    queryFn: () => getVendors(params),
  });

  const { data: categories } = useQuery({
    queryKey: ['partners', 'vendor-categories'],
    queryFn: getVendorCategories,
  });
  const categoryName = (id: string) =>
    categories?.find((category) => category.id === id)?.name ?? id;

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setVendorActive(id, active),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['partners', 'vendors'] });
    },
    onError: (error: unknown) =>
      setActionError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  async function openEdit(id: string) {
    try {
      // The list row carries only what the list needs; the modal needs contacts,
      // hire terms and the full address, so it fetches the detail rather than
      // rendering a half-populated form.
      setEditing(await getVendor(id));
      setModalOpen(true);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : MESSAGES.loadFailed,
      );
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
              <p className="text-xs text-gray-500">{row.primaryContact.phone}</p>
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
      render: (row) => <StatusBadge status={row.active ? 'active' : 'closed'} />,
    },
  ];

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} mb-2 text-2xl`}>Vendors</h1>
          <p className="text-sm text-gray-600">
            Suppliers, hirers and subcontractors. Vendor codes are allocated by the
            company series and cannot be edited.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={ROUTES.partnersVendorCategories}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field id="vendor-type-filter" label="Type">
          <SelectInput
            id="vendor-type-filter"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
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
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Active and inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </SelectInput>
        </Field>
      </div>

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No vendors match these filters."
        actions={(row) => (
          <>
            <button
              type="button"
              onClick={() => openEdit(row.id)}
              className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={toggleActive.isPending}
              onClick={() => {
                // Deactivating removes the vendor from every picker and drops its
                // contractor off the compliance screens, so it is confirmed rather
                // than being a one-click toggle in a dense table (FR-010).
                const next = !row.active;
                const message = next
                  ? `Reactivate ${row.name}?`
                  : `Deactivate ${row.name}? They will stop appearing in pickers, and any contractor profile drops off the compliance lists.`;
                if (window.confirm(message)) {
                  toggleActive.mutate({ id: row.id, active: next });
                }
              }}
              className="text-sm font-medium text-gray-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:text-gray-400"
            >
              {row.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </>
        )}
      />

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-600">
            {total} vendor{total === 1 ? '' : 's'} · page {page} of {lastPage}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium disabled:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium disabled:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <VendorModal vendor={editing} onClose={() => setModalOpen(false)} />
      )}
    </main>
  );
}
