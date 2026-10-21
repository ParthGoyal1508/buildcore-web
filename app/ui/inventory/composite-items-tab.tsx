'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  createCompositeItem,
  deleteCompositeItem,
  getCompositeItems,
  updateCompositeItem,
  type CompositeItem,
  type CompositeItemInput,
} from '@/app/lib/api/inventory';
import { ITEM_UNITS } from '@/app/lib/constants';
import { useDebounced } from '@/app/lib/use-url-state';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import { searchItems } from './inventory-search';
import Pager from './pager';

const PAGE_SIZE = 25;

/** One row of the recipe editor: the sub-item and how much of it per unit of the mix. */
interface ComponentRow {
  key: number;
  item: SearchableOption | null;
  qtyPerUnit: string;
}

interface Draft {
  name: string;
  unit: CompositeItemInput['unit'];
  description: string;
  rows: ComponentRow[];
}

let nextKey = 1;
const blankRow = (): ComponentRow => ({
  key: nextKey++,
  item: null,
  qtyPerUnit: '',
});
const EMPTY: () => Draft = () => ({
  name: '',
  unit: 'CUM',
  description: '',
  rows: [blankRow()],
});

/** Up to six decimals, the precision the recipe is stored to. */
const SIX_DP = /^\d+(\.\d{1,6})?$/;

/** "Cement 0.08 MT · Crusher Dust 0.827 MT" — the recipe in one line for the list. */
const recipeOf = (row: CompositeItem) =>
  row.components
    .map((c) => `${c.itemName} ${c.qtyPerUnit} ${c.itemUnit}`)
    .join(' · ');

/**
 * Composite items (039): a mix — "DLC Concrete for plant foundation" — defined as fixed quantities
 * of ordinary items per one unit of the mix. Issuing 10 CUM of it issues each sub-item in
 * proportion from the store; the composite itself never holds stock.
 *
 * The recipe editor is a list of rows, each an item picker and its quantity per unit, with the
 * item's own unit beside the quantity so "0.08" reads as 0.08 MT of cement and not 0.08 bags.
 * A composite that has been issued cannot be deleted — the server says so — and is deactivated
 * instead.
 */
export default function CompositeItemsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounced(search.trim());
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = { search: term || undefined, page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: ['inventory', 'composite-items', companyId, listQuery],
    queryFn: () => getCompositeItems(listQuery),
    placeholderData: keepPreviousData,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const reset = () => {
    setDraft(EMPTY());
    setEditingId(null);
    setError(null);
  };

  const failure = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message || fallback : fallback);

  const save = useMutation({
    mutationFn: (input: CompositeItemInput) =>
      editingId
        ? updateCompositeItem(editingId, input)
        : createCompositeItem(input),
    onSuccess: (row) => {
      toast.success(editingId ? `${row.name} saved` : `${row.name} added`);
      reset();
      invalidate();
    },
    onError: (err) => failure(err, 'Could not save this composite item.'),
  });

  const toggle = useMutation({
    mutationFn: (row: CompositeItem) =>
      updateCompositeItem(row.id, { active: !row.active }),
    onSuccess: (row) => {
      toast.success(
        row.active ? `${row.name} reactivated` : `${row.name} deactivated`,
      );
      invalidate();
    },
    onError: (err) => failure(err, 'Could not update this composite item.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCompositeItem(id),
    onSuccess: () => {
      setError(null);
      toast.success('Composite item deleted');
      invalidate();
    },
    onError: (err) => failure(err, 'Could not delete this composite item.'),
  });

  const setRow = (key: number, patch: Partial<ComponentRow>) =>
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  /** The draft as the API takes it, or the first thing wrong with it. */
  const validate = (): CompositeItemInput | string => {
    if (!draft.name.trim()) return 'Give the composite item a name.';
    const rows = draft.rows.filter((r) => r.item || r.qtyPerUnit.trim());
    if (rows.length === 0) return 'Add at least one sub-item.';
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.item) return 'Choose an item on every sub-item row.';
      if (seen.has(row.item.id)) {
        return `${row.item.label} is listed twice. Combine it into one row.`;
      }
      seen.add(row.item.id);
      const qty = row.qtyPerUnit.trim();
      if (!SIX_DP.test(qty) || Number(qty) <= 0) {
        return `Enter a quantity above 0 for ${row.item.label}, up to 6 decimals.`;
      }
    }
    return {
      name: draft.name.trim(),
      unit: draft.unit,
      ...(draft.description.trim()
        ? { description: draft.description.trim() }
        : {}),
      components: rows.map((r) => ({
        itemId: (r.item as SearchableOption).id,
        qtyPerUnit: Number(r.qtyPerUnit),
      })),
    };
  };

  const columns: Column<CompositeItem>[] = [
    { key: 'name', header: 'Composite item', render: (row) => row.name },
    { key: 'unit', header: 'Unit', render: (row) => row.unit },
    {
      key: 'recipe',
      header: 'Per 1 unit',
      render: (row) => (
        <span className="text-sm text-gray-700">{recipeOf(row)}</span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (row.active ? 'Active' : 'Inactive'),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const input = validate();
          if (typeof input === 'string') {
            setError(input);
            return;
          }
          setError(null);
          save.mutate(input);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            id="composite-name"
            label="Composite item *"
            placeholder="e.g. DLC Concrete for plant foundation"
            maxLength={120}
            autoComplete="off"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <SelectField
            id="composite-unit"
            label="Unit *"
            value={draft.unit}
            onChange={(event) =>
              setDraft({
                ...draft,
                unit: event.target.value as Draft['unit'],
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
            id="composite-description"
            label="Description"
            maxLength={500}
            autoComplete="off"
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />
        </div>

        <fieldset className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">
            Sub-items per 1 {draft.unit}
          </legend>
          <div className="flex flex-col gap-2">
            {draft.rows.map((row, index) => (
              <div
                key={row.key}
                className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
              >
                <div className="flex flex-col gap-1 text-sm">
                  <label
                    htmlFor={`composite-item-${row.key}`}
                    className="font-medium text-gray-700"
                  >
                    Item {index + 1}
                  </label>
                  <AsyncSelect
                    id={`composite-item-${row.key}`}
                    value={row.item?.id ?? ''}
                    onChange={(_, option) => setRow(row.key, { item: option })}
                    search={searchItems}
                    cacheKey={['inventory', 'items', 'search', companyId]}
                    selectedOption={row.item}
                    placeholder="Search items"
                  />
                </div>
                <TextField
                  id={`composite-qty-${row.key}`}
                  label={`Qty per ${draft.unit}${
                    row.item?.note ? ` (${row.item.note})` : ''
                  }`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.qtyPerUnit}
                  onChange={(event) =>
                    setRow(row.key, { qtyPerUnit: event.target.value })
                  }
                />
                <RowAction
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      rows:
                        d.rows.length > 1
                          ? d.rows.filter((r) => r.key !== row.key)
                          : [blankRow()],
                    }))
                  }
                  title="Remove this sub-item"
                >
                  Remove
                </RowAction>
              </div>
            ))}
            <div>
              <SecondaryButton
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, rows: [...d.rows, blankRow()] }))
                }
              >
                Add sub-item
              </SecondaryButton>
            </div>
          </div>
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending}>
            {editingId ? 'Save changes' : 'Add composite item'}
          </Button>
          {editingId && (
            <SecondaryButton type="button" onClick={reset}>
              Cancel
            </SecondaryButton>
          )}
        </div>
      </form>

      <FormError message={error} />

      <div className="border-t border-gray-100 pt-4">
        <TextField
          id="composite-search"
          label="Search composite items"
          type="search"
          autoComplete="off"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={list.data?.compositeItems ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={list.refetch}
        serverPaged
        isRefreshing={list.isPlaceholderData}
        emptyMessage={
          term
            ? 'No composite item matches this search.'
            : 'No composite items yet. Add a mix such as a concrete grade with its sub-items per unit.'
        }
        actions={(row) => (
          <div className="flex gap-2">
            <RowAction
              onClick={() => {
                setEditingId(row.id);
                setError(null);
                setDraft({
                  name: row.name,
                  unit: row.unit as Draft['unit'],
                  description: row.description ?? '',
                  rows: row.components.map((c) => ({
                    key: nextKey++,
                    item: {
                      id: c.itemId,
                      label: c.itemName,
                      sublabel: c.itemCode,
                      note: c.itemUnit,
                    },
                    qtyPerUnit: String(c.qtyPerUnit),
                  })),
                });
              }}
            >
              Edit
            </RowAction>
            <RowAction
              onClick={() => toggle.mutate(row)}
              loading={toggle.isPending && toggle.variables?.id === row.id}
              title={
                row.active
                  ? 'Stop offering this composite on new issues'
                  : 'Offer this composite again'
              }
            >
              {row.active ? 'Deactivate' : 'Reactivate'}
            </RowAction>
            <RowAction
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Delete this composite item?',
                    message:
                      'This cannot be undone. A composite that has been issued cannot be deleted; deactivate it instead.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                )
                  remove.mutate(row.id);
              }}
              loading={remove.isPending && remove.variables === row.id}
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      <Pager
        total={list.data?.total ?? 0}
        page={list.data?.page ?? page}
        pageSize={list.data?.pageSize ?? PAGE_SIZE}
        onPageChange={setPage}
        noun="composite item"
      />
    </div>
  );
}
