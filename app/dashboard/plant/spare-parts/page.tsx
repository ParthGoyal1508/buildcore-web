'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteSparePart,
  getSpareParts,
  getSparePartReconciliation,
  type SparePart,
} from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import SparePartModal, {
  ReceivePartModal,
} from '@/app/ui/plant/spare-part-modal';
import { usePlantCategories } from '@/app/ui/plant/use-plant-refs';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

export default function SparePartsPage() {
  const queryClient = useQueryClient();
  const categories = usePlantCategories();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [belowReorder, setBelowReorder] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SparePart | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [receiving, setReceiving] = useState<SparePart | null>(null);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    page,
    ...(search ? { search } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(belowReorder ? { belowReorder: 'true' } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'spare-parts', filters],
    queryFn: () => getSpareParts(filters),
  });

  const reconciliation = useQuery({
    queryKey: ['plant', 'spare-parts', 'reconciliation'],
    queryFn: getSparePartReconciliation,
    enabled: showReconciliation,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSparePart(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not delete this spare part.',
      ),
  });

  const columns: Column<SparePart>[] = [
    {
      key: 'part',
      header: 'Part',
      // The low-stock marker is on the row itself, so a storekeeper scanning the
      // list sees what needs ordering without opening anything.
      render: (row) => (
        <span className="flex flex-col">
          <span>
            {row.partNumber} · {row.name}
          </span>
          {row.belowReorderLevel && (
            <span className="text-xs font-medium text-red-700">
              At or below reorder level
            </span>
          )}
          {!row.active && (
            <span className="text-xs text-gray-500">Retired</span>
          )}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'In stock',
      render: (row) => `${row.stockQuantity} ${row.unitOfMeasure}`,
    },
    {
      key: 'reorder',
      header: 'Reorder at',
      hideOnCard: true,
      render: (row) => row.reorderLevel ?? '—',
    },
    {
      key: 'rate',
      header: 'Avg rate',
      render: (row) => formatRupees(row.avgRate),
    },
    {
      key: 'value',
      header: 'Stock value',
      render: (row) => formatRupees(row.stockValue),
    },
    {
      key: 'fits',
      header: 'Fits',
      hideOnCard: true,
      render: (row) =>
        row.compatibleCategoryNames.length === 0
          ? 'Any category'
          : row.compatibleCategoryNames.join(', '),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Spare Parts</h1>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            aria-expanded={showReconciliation}
            onClick={() => setShowReconciliation((current) => !current)}
          >
            {showReconciliation ? 'Hide' : 'Show'} inventory reconciliation
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            Register a part
          </SecondaryButton>
        </div>
      </div>

      {data && data.belowReorderCount > 0 && (
        <p className="text-sm text-red-700">
          {data.belowReorderCount}{' '}
          {data.belowReorderCount === 1 ? 'part is' : 'parts are'} at or below
          reorder level.
        </p>
      )}

      {/*
        FR-024's reconciliation. The two stocks are independent by design — a
        workshop shelf and a site store are different places — so this exists to
        make a divergence visible, not to reconcile them.
      */}
      {showReconciliation && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Parts also stocked as inventory items
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            These two stocks are kept separately on purpose. A difference is not an
            error to fix here — it is what this view exists to show.
          </p>
          <ResponsiveList
            columns={[
              {
                key: 'part',
                header: 'Spare part',
                render: (row: { partNumber: string; partName: string }) =>
                  `${row.partNumber} · ${row.partName}`,
              },
              {
                key: 'plant',
                header: 'Workshop stock',
                render: (row: { plantStock: number }) => row.plantStock,
              },
              {
                key: 'item',
                header: 'Inventory item',
                render: (row: { inventoryItemName: string | null }) =>
                  row.inventoryItemName ?? 'Unknown item',
              },
              {
                key: 'inventory',
                header: 'Inventory stock',
                render: (row: { inventoryStock: number | null }) =>
                  row.inventoryStock ?? '—',
              },
              {
                key: 'difference',
                header: 'Difference',
                render: (row: { difference: number | null }) =>
                  row.difference === null ? (
                    '—'
                  ) : row.difference === 0 ? (
                    <span className="text-sm text-gray-500">In step</span>
                  ) : (
                    <span className="text-sm font-medium text-orange-700">
                      {row.difference > 0 ? '+' : ''}
                      {row.difference}
                    </span>
                  ),
              },
            ]}
            rows={reconciliation.data?.items ?? []}
            rowKey={(row) => row.sparePartId}
            isLoading={reconciliation.isPending}
            emptyMessage={MESSAGES.plantReconciliationEmpty}
          />
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          id="parts-search"
          label="Search"
          placeholder="Part number or name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // Back to the first page: narrowing the list while on page three
            // would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
        <SelectField
          id="parts-filter-category"
          label="Fits category"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any category</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <div className="flex items-end pb-2">
          <CheckboxField
            id="parts-filter-reorder"
            label="Below reorder level only"
            checked={belowReorder}
            onChange={(event) => {
              setBelowReorder(event.target.checked);
              setPage(1);
            }}
          />
        </div>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.plantLoadFailed : undefined}
        emptyMessage={MESSAGES.plantSparePartsEmpty}
        actions={(row) => (
          <>
            <RowAction onClick={() => setReceiving(row)}>Receive</RowAction>
            <RowAction
              onClick={() => {
                setEditing(row);
                setShowModal(true);
              }}
            >
              Edit
            </RowAction>
            <RowAction
              onClick={() => {
                if (window.confirm(`Delete ${row.partNumber}?`)) {
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
        noun="part"
      />

      {showModal && (
        <SparePartModal
          part={editing ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}
      {receiving && (
        <ReceivePartModal
          part={receiving}
          onClose={() => setReceiving(null)}
        />
      )}
    </div>
  );
}
