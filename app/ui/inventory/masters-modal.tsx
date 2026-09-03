'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  getCategories,
  getItems,
  updateItem,
  type Item,
  type ItemInput,
} from '@/app/lib/api/inventory';
import { ApiError } from '@/app/lib/api/client';
import { ITEM_UNITS, MESSAGES } from '@/app/lib/constants';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

/**
 * The item and category masters, as a two-tab dialog opened from the Stock screen.
 *
 * Not a route, deliberately. These are `settings`-schema company reference data
 * gated on `SETTINGS` rather than `INVENTORY` (009 research.md §1), so a storekeeper
 * with `INVENTORY` alone must not see them — and a modal with a hidden trigger has
 * no URL for them to reach anyway. `StockTable` renders the button only when the
 * permission is held.
 */
type Tab = 'items' | 'categories';

/** Turns an API failure into the message this module has agreed to show for it. */
function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return error.message;
    return error.message || fallback;
  }
  return fallback;
}

function CategoryTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: getCategories,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
  };

  const create = useMutation({
    mutationFn: (value: string) => createCategory(value),
    onSuccess: () => {
      setName('');
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(messageFor(err, 'Could not add this category.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(messageFor(err, MESSAGES.categoryHasItems)),
  });

  const columns: Column<{ id: string; name: string; itemCount: number }>[] = [
    { key: 'name', header: 'Category', render: (row) => row.name },
    {
      key: 'itemCount',
      header: 'Items',
      render: (row) => row.itemCount,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          create.mutate(name.trim());
        }}
      >
        <div className="min-w-[12rem] flex-1">
          <TextField
            id="new-category"
            label="New category"
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Stored in capitals, so one spelling is one category."
          />
        </div>
        <SecondaryButton type="submit" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add'}
        </SecondaryButton>
      </form>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.categoriesEmpty}
        actions={(row) => (
          <RowAction
            onClick={() => remove.mutate(row.id)}
            // Offered only when nothing is in the way. The backend refuses a
            // category with items anyway; hiding the control means the refusal is
            // not the first the user hears of it.
            disabled={row.itemCount > 0 || remove.isPending}
            title={
              row.itemCount > 0 ? MESSAGES.categoryHasItems : 'Delete category'
            }
          >
            Delete
          </RowAction>
        )}
      />
    </div>
  );
}

const EMPTY_ITEM: ItemInput = {
  name: '',
  categoryId: '',
  unit: 'BAG',
};

function ItemTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ItemInput>(EMPTY_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: getCategories,
  });
  const items = useQuery({
    queryKey: ['inventory', 'items', {}],
    queryFn: () => getItems({ pageSize: 200 }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const reset = () => {
    setDraft(EMPTY_ITEM);
    setEditingId(null);
    setError(null);
  };

  const save = useMutation({
    mutationFn: (input: ItemInput) =>
      editingId ? updateItem(editingId, input) : createItem(input),
    onSuccess: () => {
      reset();
      invalidate();
    },
    onError: (err) => setError(messageFor(err, 'Could not save this item.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(messageFor(err, MESSAGES.itemInUse)),
  });

  const retire = useMutation({
    mutationFn: (item: Item) => updateItem(item.id, { active: !item.active }),
    onSuccess: invalidate,
    onError: (err) => setError(messageFor(err, 'Could not update this item.')),
  });

  const columns: Column<Item>[] = [
    { key: 'code', header: 'Code', render: (row) => row.code },
    { key: 'name', header: 'Item', render: (row) => row.name },
    { key: 'category', header: 'Category', render: (row) => row.categoryName },
    { key: 'unit', header: 'Unit', render: (row) => row.unit },
    {
      key: 'reorderLevel',
      header: 'Reorder level',
      render: (row) => row.reorderLevel ?? '—',
    },
    {
      key: 'hsnCode',
      header: 'HSN',
      hideOnCard: true,
      render: (row) => row.hsnCode ?? '—',
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (row.active ? 'Active' : 'Retired'),
    },
  ];

  const categoryOptions = categories.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim() || !draft.categoryId) {
            setError('An item needs a name and a category.');
            return;
          }
          save.mutate({ ...draft, name: draft.name.trim() });
        }}
      >
        <TextField
          id="item-name"
          label="Item"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <SelectField
          id="item-category"
          label="Category"
          value={draft.categoryId}
          onChange={(event) =>
            setDraft({ ...draft, categoryId: event.target.value })
          }
        >
          <option value="">Select…</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="item-unit"
          label="Unit"
          value={draft.unit}
          onChange={(event) =>
            setDraft({
              ...draft,
              unit: event.target.value as ItemInput['unit'],
            })
          }
        >
          {ITEM_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </SelectField>
        <TextField
          id="item-reorder"
          label="Reorder level"
          type="number"
          min={0}
          step="any"
          value={draft.reorderLevel ?? ''}
          onChange={(event) =>
            setDraft({
              ...draft,
              reorderLevel:
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
            })
          }
          hint="Leave blank for an item with no stock floor."
        />
        <TextField
          id="item-hsn"
          label="HSN code"
          value={draft.hsnCode ?? ''}
          onChange={(event) =>
            setDraft({ ...draft, hsnCode: event.target.value })
          }
        />
        <div className="flex items-end gap-2">
          <SecondaryButton type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add item'}
          </SecondaryButton>
          {editingId && (
            <SecondaryButton type="button" onClick={reset}>
              Cancel
            </SecondaryButton>
          )}
        </div>
      </form>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={items.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={items.isPending}
        error={items.isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.itemsEmpty}
        actions={(row) => (
          <div className="flex gap-2">
            <RowAction
              onClick={() => {
                setEditingId(row.id);
                setError(null);
                setDraft({
                  name: row.name,
                  categoryId: row.categoryId,
                  unit: row.unit as ItemInput['unit'],
                  reorderLevel: row.reorderLevel ?? undefined,
                  hsnCode: row.hsnCode ?? undefined,
                  description: row.description ?? undefined,
                });
              }}
            >
              Edit
            </RowAction>
            <RowAction
              onClick={() => retire.mutate(row)}
              title={
                row.active
                  ? 'Stop offering this item on new records'
                  : 'Offer this item again'
              }
            >
              {row.active ? 'Retire' : 'Restore'}
            </RowAction>
            <RowAction
              onClick={() => remove.mutate(row.id)}
              disabled={remove.isPending}
              title={MESSAGES.itemInUse}
            >
              Delete
            </RowAction>
          </div>
        )}
      />
    </div>
  );
}

export default function MastersModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('items');

  return (
    <Modal title="Item masters" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div
          className="flex gap-2 border-b border-gray-200"
          role="tablist"
          aria-label="Master data"
        >
          {(['items', 'categories'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? 'border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700'
                  : 'px-3 py-2 text-sm text-gray-600 hover:text-gray-900'
              }
            >
              {value === 'items' ? 'Items' : 'Categories'}
            </button>
          ))}
        </div>

        {tab === 'items' ? <ItemTab /> : <CategoryTab />}
      </div>
    </Modal>
  );
}
