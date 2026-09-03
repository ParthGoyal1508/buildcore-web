'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  VendorCategory,
  deleteVendorCategory,
  getVendorCategories,
} from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import VendorCategoryModal from '@/app/ui/partners/vendor-category-modal';

export default function VendorCategoriesPage() {
  const [editing, setEditing] = useState<VendorCategory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'vendor-categories'],
    queryFn: getVendorCategories,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteVendorCategory(id),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['partners', 'vendor-categories'] });
    },
    onError: (error: unknown) => {
      // The backend refuses with a 409 and says how many vendors are in the way.
      // Surfacing its message beats a generic failure, because the count is the
      // thing the user needs in order to act.
      setDeleteError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      );
    },
  });

  const columns: Column<VendorCategory>[] = [
    {
      key: 'name',
      header: 'Category',
      sticky: true,
      render: (row) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'vendorCount',
      header: 'Vendors',
      numeric: true,
      render: (row) => row.vendorCount,
    },
    {
      key: 'isDefault',
      header: 'Source',
      render: (row) => (row.isDefault ? 'Seeded default' : 'Added here'),
    },
  ];

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} mb-2 text-2xl`}>
            Vendor categories
          </h1>
          <p className="text-sm text-gray-600">
            What a vendor deals in. Every company starts with six; a category can
            only be deleted once no vendor is tagged with it.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Add category
        </Button>
      </div>

      {deleteError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {deleteError}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No vendor categories yet."
        actions={(row) => (
          <>
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              onClick={() => {
                setEditing(row);
                setModalOpen(true);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-sm font-medium text-red-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:text-gray-400 disabled:no-underline"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete the "${row.name}" category? This cannot be undone.`,
                  )
                ) {
                  remove.mutate(row.id);
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      />

      {modalOpen && (
        <VendorCategoryModal
          category={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}
