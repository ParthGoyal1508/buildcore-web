'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { ITEM_UNITS, MESSAGES } from '@/app/lib/constants';
import { quantity } from '@/app/lib/format';
import { useDebounced } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import Pager from './pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { confirmDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';

const ITEM_PAGE_SIZE = 25;

/**
 * The item and category masters, as a two-tab dialog opened from the Stock screen.
 *
 * Not a route, deliberately. These are `settings`-schema company reference data
 * gated on `SETTINGS` rather than `INVENTORY` (009 research.md §1), so a storekeeper
 * with `INVENTORY` alone must not see them — and a modal with a hidden trigger has
 * no URL for them to reach anyway. `StockTable` renders the button only when the
 * permission is held.
 *
 * 036 M5 (2026-10-17): the item list loaded one page of 200, so the 201st item could not be found,
 * edited, retired or deleted here at all. It is now searched on the server (debounced) and paged.
 * Categories come back whole from the API and are few, so their search filters in place.
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
  const toast = useToast();
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, error: loadError, refetch } = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: getCategories,
  });
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? (data ?? []).filter((row) => row.name.toLowerCase().includes(needle))
    : (data ?? []);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['inventory', 'categories'],
    });
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] });
  };

  const create = useMutation({
    mutationFn: (value: string) => createCategory(value),
    onSuccess: (category) => {
      setName('');
      setError(null);
      toast.success(`Category ${category.name} added`);
      invalidate();
    },
    onError: (err) => setError(messageFor(err, 'Could not add this category.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      setError(null);
      toast.success('Category deleted');
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
        <Button
          type="submit"
          disabled={!name.trim()}
          loading={create.isPending}
        >
          Add
        </Button>
      </form>

      <FormError message={error} />

      <TextField
        id="category-search"
        label="Search categories"
        type="search"
        autoComplete="off"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />

      <ResponsiveList
        columns={columns}
        rows={shown}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={loadError}
        onRetry={refetch}
        emptyMessage={
          needle ? `No category matches “${filter.trim()}”.` : MESSAGES.categoriesEmpty
        }
        actions={(row) => (
          <RowAction
            onClick={async () => {
              if (
                await confirmDialog({
                  title: 'Delete this category?',
                  message: 'This cannot be undone.',
                  confirmLabel: 'Delete',
                  tone: 'danger',
                })
              )
                remove.mutate(row.id);
            }}
            // Offered only when nothing is in the way. The backend refuses a
            // category with items anyway; hiding the control means the refusal is
            // not the first the user hears of it.
            disabled={row.itemCount > 0 || remove.isPending}
            loading={remove.isPending && remove.variables === row.id}
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
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounced(search.trim());
  const [draft, setDraft] = useState<ItemInput>(EMPTY_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: getCategories,
  });
  const itemQuery = {
    search: term || undefined,
    categoryId: categoryFilter || undefined,
    page,
    pageSize: ITEM_PAGE_SIZE,
  };
  const items = useQuery({
    queryKey: ['inventory', 'items', 'masters', companyId, itemQuery],
    queryFn: () => getItems(itemQuery),
    placeholderData: keepPreviousData,
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
    onSuccess: (item) => {
      toast.success(editingId ? `${item.name} saved` : `${item.name} added`);
      reset();
      invalidate();
    },
    onError: (err) => setError(messageFor(err, 'Could not save this item.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      setError(null);
      toast.success('Item deleted');
      invalidate();
    },
    onError: (err) => setError(messageFor(err, MESSAGES.itemInUse)),
  });

  const retire = useMutation({
    mutationFn: (item: Item) => updateItem(item.id, { active: !item.active }),
    onSuccess: (item) => {
      toast.success(item.active ? `${item.name} restored` : `${item.name} retired`);
      invalidate();
    },
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
      render: (row) =>
        row.reorderLevel === null ? '—' : quantity(row.reorderLevel),
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
          label="Item *"
          maxLength={120}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <SelectField
          id="item-category"
          label="Category *"
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
          label="Unit *"
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
          maxLength={20}
          value={draft.hsnCode ?? ''}
          onChange={(event) =>
            setDraft({ ...draft, hsnCode: event.target.value })
          }
        />
        <div className="flex items-end gap-2">
          <Button type="submit" loading={save.isPending}>
            {editingId ? 'Save changes' : 'Add item'}
          </Button>
          {editingId && (
            <SecondaryButton type="button" onClick={reset}>
              Cancel
            </SecondaryButton>
          )}
        </div>
      </form>

      <FormError message={error} />

      <div className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
        <TextField
          id="item-search"
          label="Search items"
          type="search"
          autoComplete="off"
          placeholder="Name or code"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <SelectField
          id="item-category-filter"
          label="Category"
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={items.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={items.isPending}
        error={items.error}
        onRetry={items.refetch}
        serverPaged
        isRefreshing={items.isPlaceholderData}
        emptyMessage={
          term || categoryFilter ? 'No item matches this search.' : MESSAGES.itemsEmpty
        }
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
              loading={retire.isPending && retire.variables?.id === row.id}
              title={
                row.active
                  ? 'Stop offering this item on new records'
                  : 'Offer this item again'
              }
            >
              {row.active ? 'Retire' : 'Restore'}
            </RowAction>
            <RowAction
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Delete this item?',
                    message: 'This cannot be undone.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                )
                  remove.mutate(row.id);
              }}
              loading={remove.isPending && remove.variables === row.id}
              title={MESSAGES.itemInUse}
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      <Pager
        total={items.data?.total ?? 0}
        page={items.data?.page ?? page}
        pageSize={items.data?.pageSize ?? ITEM_PAGE_SIZE}
        onPageChange={setPage}
        noun="item"
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
                  ? 'border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-brand-700'
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
