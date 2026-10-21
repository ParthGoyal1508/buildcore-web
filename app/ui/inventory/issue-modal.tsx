'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  createIssue,
  getCompositeChoices,
  getCompositePreview,
  getEquipmentChoices,
  getStockHint,
  type CompositePreview,
  type IssueInput,
} from '@/app/lib/api/inventory';
import { getSite } from '@/app/lib/api/projects';
import { MESSAGES } from '@/app/lib/constants';
import {
  quantity as formatQuantity,
  quantity3,
  todayIso,
} from '@/app/lib/format';
import { useDebounced } from '@/app/lib/use-url-state';
import AsyncSelect, {
  type AsyncSearchPage,
  type SearchableOption,
} from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';
import {
  searchProjects,
  searchSites,
  searchStoreStock,
  searchVendors,
} from './inventory-search';

const today = () => todayIso();

/** Active composites for the picker (039). The server returns the first 50 matches, unpaged. */
function searchComposites(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  if (page > 1) return Promise.resolve({ items: [], total: 0 });
  return getCompositeChoices(term || undefined).then((rows) => ({
    items: rows.map((row) => ({
      id: row.id,
      label: row.name,
      // The recipe per unit, so the person sees what they are about to deduct.
      sublabel: row.components
        .map((c) => `${c.itemName} ${quantity3(c.qtyPerUnit)} ${c.itemUnit}`)
        .join(' · '),
      note: row.unit,
    })),
    total: rows.length,
  }));
}

/**
 * Issue material from a store.
 *
 * Two things make this screen different from the purchase form. The item list is
 * drawn from *what is actually in that store* rather than from the item master —
 * offering an item the store has never received is offering a choice that ends in a
 * 422. And the available quantity is fetched live for the chosen item-store pair, so
 * the number the user is typing against is the number the server will check.
 *
 * The hint is advisory, not authoritative. Between reading it and submitting, another
 * issue can take the same material; the backend's locked check is the only thing that
 * decides, and its 422 is shown against the quantity field rather than as a page
 * error (009 US4 AC2).
 *
 * The project and the vendor or subcontractor were added on 2026-10-15 — the client: "while
 * issuing material we want to give an option to select Project and vendor or subcontractor".
 * The project follows the store's own until the user picks another; naming a vendor makes the
 * person optional, since the vendor's name is then recorded as who took it.
 *
 * The equipment number was added the same day for the client's issue slip ("Equipment No. (if
 * applicable)"). It is text the registered machines are *suggested* into, not a choice from
 * them: the slip prints what was written, a hired machine may not be registered yet, and a user
 * without machinery permission cannot read the register at all — then it is simply a text box.
 *
 * 036 M5 (2026-10-17): store, item, project and vendor are server-search pickers — each loaded one
 * page of 200 and the rest could not be chosen. The item picker searches what the store holds,
 * with the quantity in stock beside each name. Against an indent line the store and item are
 * fixed: the server refuses any other (036 M2).
 *
 * 039: the item picker offers only what the store has in stock — an item at zero is a choice that
 * can only end in a refusal. And a *composite item* ("DLC Concrete for plant foundation", per CUM:
 * cement, crusher dust, aggregates, fly ash) can be issued instead of a single item: the quantity
 * is then in the composite's unit, and every sub-item is issued from the store in proportion,
 * shown below with the store's stock against each and any shortfall flagged before submitting.
 * The server checks all of them again under lock and refuses with every short line at once.
 * Indent lines name a single item, so against one only an item can be issued.
 */
export default function IssueModal({
  onClose,
  indentLineId,
  outstandingQuantity,
  defaults,
  defaultLabels,
}: {
  onClose: () => void;
  /** Set when the issue is raised against an approved indent line (009 FR-023). */
  indentLineId?: string;
  /** The line's approved-minus-fulfilled figure, when there is one (009 FR-020). */
  outstandingQuantity?: number;
  defaults?: Partial<IssueInput>;
  /** Names for `defaults`' store and item, so the pickers can show them. */
  defaultLabels?: { siteName?: string; itemName?: string; itemCode?: string };
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const fixed = Boolean(indentLineId);

  const [site, setSite] = useState<SearchableOption | null>(
    defaults?.siteId
      ? { id: defaults.siteId, label: defaultLabels?.siteName ?? '' }
      : null,
  );
  const [item, setItem] = useState<SearchableOption | null>(
    defaults?.itemId
      ? {
          id: defaults.itemId,
          label: defaultLabels?.itemName ?? '',
          sublabel: defaultLabels?.itemCode,
        }
      : null,
  );
  const siteId = site?.id ?? '';
  const [mode, setMode] = useState<'item' | 'composite'>('item');
  const [composite, setComposite] = useState<SearchableOption | null>(null);
  const isComposite = mode === 'composite';
  const itemId = isComposite ? '' : (item?.id ?? '');
  const compositeId = isComposite ? (composite?.id ?? '') : '';
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  // `null` = not chosen, so the store's project applies; '' = deliberately none.
  const [projectChoice, setProjectChoice] = useState<string | null>(
    defaults?.projectId ?? null,
  );
  const [project, setProject] = useState<SearchableOption | null>(null);
  const [vendor, setVendor] = useState<SearchableOption | null>(null);
  const vendorId = vendor?.id ?? '';
  const [remarks, setRemarks] = useState('');
  const [equipmentNo, setEquipmentNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  // The store's own project, which the issue is tagged with unless another is chosen.
  const store = useQuery({
    queryKey: ['inventory', 'site', siteId],
    queryFn: () => getSite(siteId),
    enabled: Boolean(siteId),
    staleTime: 5 * 60_000,
  });

  const hint = useQuery({
    queryKey: ['inventory', 'stock-hint', itemId, siteId],
    queryFn: () => getStockHint(itemId, siteId),
    enabled: Boolean(itemId && siteId),
  });

  // No retry: a 403 for a user without machinery permission is the answer, not a blip.
  const machines = useQuery({
    queryKey: ['inventory', 'equipment-choices'],
    queryFn: getEquipmentChoices,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const storeProjectId = store.data?.projectId ?? '';
  const projectId = projectChoice ?? storeProjectId;

  // What each sub-item of a composite needs from this store, against its stock now (039).
  const previewQuantity = useDebounced(Number(quantity));
  const preview = useQuery({
    queryKey: [
      'inventory',
      'composite-preview',
      compositeId,
      siteId,
      previewQuantity,
    ],
    queryFn: () =>
      getCompositePreview({
        compositeItemId: compositeId,
        siteId,
        quantity: previewQuantity,
      }),
    enabled: Boolean(compositeId && siteId && previewQuantity > 0),
    placeholderData: keepPreviousData,
  });
  const previewFresh =
    preview.data !== undefined &&
    !preview.isPlaceholderData &&
    previewQuantity === Number(quantity);

  const available = isComposite ? null : (hint.data?.inStock ?? null);
  const unit = isComposite ? (composite?.note ?? '') : (hint.data?.unit ?? '');

  const exceedsOutstanding =
    outstandingQuantity !== undefined &&
    quantity !== '' &&
    Number(quantity) > outstandingQuantity;

  const save = useMutation({
    mutationFn: () =>
      createIssue({
        siteId,
        ...(isComposite ? { compositeItemId: compositeId } : { itemId }),
        date,
        quantity: Number(quantity),
        ...(issuedTo.trim() ? { issuedTo: issuedTo.trim() } : {}),
        ...(projectId ? { projectId } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
        ...(equipmentNo.trim() ? { equipmentNo: equipmentNo.trim() } : {}),
        ...(indentLineId ? { indentLineId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(
        isComposite
          ? `${quantity3(Number(quantity))} ${unit} of ${composite?.label ?? 'the composite'} issued`
          : `${formatQuantity(Number(quantity))}${unit ? ` ${unit}` : ''} of ${item?.label ?? 'material'} issued`,
      );
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        // Against the quantity field, where the user can act on it — not as a page
        // banner that loses the connection to what was typed. A composite's refusal names every
        // short sub-item; the table below is refreshed to show them.
        setQuantityError(err.message);
        if (isComposite) void preview.refetch();
        return;
      }
      setError(errorMessage(err, 'Could not record this issue.'));
    },
  });

  const ready =
    siteId &&
    (isComposite
      ? compositeId && !(previewFresh && preview.data?.blocked)
      : itemId) &&
    date &&
    Number(quantity) > 0 &&
    (issuedTo.trim() || vendorId) &&
    !exceedsOutstanding;

  return (
    <Modal
      title="Issue material"
      onClose={onClose}
      isDirty={Boolean(
        quantity || issuedTo || remarks || (!fixed && (itemId || compositeId)),
      )}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="issue-form"
            disabled={!ready}
            loading={save.isPending}
          >
            Issue
          </Button>
        </>
      }
    >
      <form
        id="issue-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setQuantityError(null);
          save.mutate();
        }}
      >
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issue-site" className="font-medium text-gray-700">
            Store <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            id="issue-site"
            value={siteId}
            onChange={(_, option) => {
              setSite(option);
              // Changing the store invalidates the item choice: the previous
              // item may not exist at the new one (009 FR-005).
              setItem(null);
            }}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={site}
            disabled={fixed}
            placeholder="Search stores"
          />
        </div>

        {!fixed && (
          <div
            role="radiogroup"
            aria-label="What is being issued"
            className="grid grid-cols-2 gap-2 sm:col-span-2"
          >
            {(['item', 'composite'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => {
                  setMode(value);
                  setQuantityError(null);
                }}
                className={clsx(
                  'h-10 rounded-lg border text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
                  mode === value
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                {value === 'item' ? 'Single item' : 'Composite item'}
              </button>
            ))}
          </div>
        )}

        {isComposite ? (
          <div className="flex flex-col gap-1 text-sm">
            <label
              htmlFor="issue-composite"
              className="font-medium text-gray-700"
            >
              Composite item <span className="text-red-600">*</span>
            </label>
            <AsyncSelect
              id="issue-composite"
              value={compositeId}
              onChange={(_, option) => setComposite(option)}
              search={searchComposites}
              cacheKey={['inventory', 'composite-choices', companyId]}
              selectedOption={composite}
              disabled={!siteId}
              placeholder={
                siteId ? 'Search composite items' : 'Choose a store first'
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="issue-item" className="font-medium text-gray-700">
              Item <span className="text-red-600">*</span>
            </label>
            <AsyncSelect
              // Remounted per store so the results are the new store's stock.
              key={siteId || 'none'}
              id="issue-item"
              value={itemId}
              onChange={(_, option) => setItem(option)}
              // Only what this store has on hand (009 research.md §7; 039).
              search={searchStoreStock(siteId, { inStockOnly: true })}
              cacheKey={[
                'inventory',
                'stock',
                'search',
                'in-stock',
                companyId,
                siteId,
              ]}
              selectedOption={item}
              disabled={!siteId || fixed}
              placeholder={
                siteId ? 'Search this store’s stock' : 'Choose a store first'
              }
            />
          </div>
        )}

        <TextField
          id="issue-date"
          label="Date *"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          id="issue-quantity"
          label={unit ? `Quantity (${unit}) *` : 'Quantity *'}
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            setQuantityError(null);
          }}
          error={
            quantityError ??
            (exceedsOutstanding
              ? MESSAGES.outstandingExceeded(outstandingQuantity!)
              : undefined)
          }
          hint={
            isComposite
              ? compositeId
                ? 'Each sub-item is issued in proportion — see below.'
                : undefined
              : available !== null
                ? MESSAGES.stockHint(available, unit)
                : itemId
                  ? 'Checking available stock…'
                  : undefined
          }
        />

        {isComposite && compositeId && siteId && Number(quantity) > 0 && (
          <div className="sm:col-span-2">
            <CompositeLines
              preview={preview.data}
              loading={preview.isPending || !previewFresh}
              error={preview.error}
            />
          </div>
        )}

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issue-project" className="font-medium text-gray-700">
            Project
          </label>
          <AsyncSelect
            id="issue-project"
            value={projectId}
            onChange={(id, option) => {
              setProjectChoice(id);
              setProject(option);
            }}
            search={searchProjects}
            cacheKey={['inventory', 'projects', 'search', companyId]}
            selectedOption={
              project ??
              (projectChoice === null && storeProjectId
                ? { id: storeProjectId, label: 'The store’s own project' }
                : null)
            }
            emptyLabel="No project"
            aria-describedby={
              projectChoice === null && storeProjectId
                ? 'issue-project-hint'
                : undefined
            }
          />
          {projectChoice === null && storeProjectId && (
            <p id="issue-project-hint" className="text-xs text-gray-500">
              Tagged with the store&apos;s project unless you choose another.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issue-vendor" className="font-medium text-gray-700">
            Vendor / subcontractor
          </label>
          <AsyncSelect
            id="issue-vendor"
            value={vendorId}
            onChange={(_, option) => setVendor(option)}
            search={searchVendors}
            cacheKey={['inventory', 'vendors', 'search', companyId]}
            selectedOption={vendor}
            emptyLabel="None — issued to own staff"
          />
        </div>

        <TextField
          id="issue-to"
          label={vendorId ? 'Received by (optional)' : 'Issued to *'}
          placeholder={vendorId ? "Their person's name" : 'Name of who took it'}
          // The browser's own suggestions ("Plinth Work" from some earlier form) popped
          // over the field and read as part of the app.
          autoComplete="off"
          value={issuedTo}
          onChange={(event) => setIssuedTo(event.target.value)}
        />

        <TextField
          id="issue-equipment"
          label="Equipment no. (if applicable)"
          placeholder={
            machines.data ? 'Pick or type, e.g. JCB01/2027' : 'e.g. JCB01/2027'
          }
          autoComplete="off"
          list={machines.data?.length ? 'issue-equipment-list' : undefined}
          value={equipmentNo}
          onChange={(event) => setEquipmentNo(event.target.value)}
        />
        {machines.data && (
          <datalist id="issue-equipment-list">
            {machines.data.map((machine) => (
              <option key={machine.id} value={machine.code}>
                {machine.name}
              </option>
            ))}
          </datalist>
        )}

        <TextField
          id="issue-remarks"
          label="Remarks"
          autoComplete="off"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />

        {outstandingQuantity !== undefined && (
          <div className="sm:col-span-2">
            <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">
              This indent line has {formatQuantity(outstandingQuantity)}
              {unit ? ` ${unit}` : ''} outstanding.
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

/**
 * The sub-items a composite issue will take (039): read-only, with the store's stock against each
 * and the shortfall in red. Quantities to three decimals, the precision the issue deducts at.
 */
function CompositeLines({
  preview,
  loading,
  error,
}: {
  preview: CompositePreview | undefined;
  loading: boolean;
  error: unknown;
}) {
  if (error) {
    return (
      <p className="text-sm text-red-700">
        {errorMessage(error, 'Could not work out the sub-items.')}
      </p>
    );
  }
  if (!preview) {
    return <p className="text-sm text-gray-500">Working out the sub-items…</p>;
  }
  const short = preview.lines.filter((line) => line.short > 0);
  const tooSmall = preview.lines.filter((line) => line.required === 0);
  return (
    <div
      className={clsx('flex flex-col gap-2', loading && 'opacity-60')}
      aria-busy={loading}
    >
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            Sub-items issued for {quantity3(preview.quantity)} {preview.unit}{' '}
            of {preview.compositeItemName}
          </caption>
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-600">
            <tr>
              <th scope="col" className="px-3 py-2">
                Sub-item
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Per {preview.unit}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                To issue
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                In store
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {preview.lines.map((line) => (
              <tr
                key={line.itemId}
                className={line.short > 0 ? 'bg-red-50' : undefined}
              >
                <td className="px-3 py-2">
                  {line.itemName}
                  {line.short > 0 && (
                    <span className="block text-xs text-red-700">
                      Short by {quantity3(line.short)} {line.unit}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {quantity3(line.qtyPerUnit)} {line.unit}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {quantity3(line.required)} {line.unit}
                </td>
                <td
                  className={clsx(
                    'px-3 py-2 text-right tabular-nums',
                    line.short > 0 && 'text-red-700',
                  )}
                >
                  {quantity3(line.available)} {line.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {short.length > 0 && (
        <p role="alert" className="text-sm text-red-700">
          This store is short of{' '}
          {short.map((line) => line.itemName).join(', ')}. Issue a smaller
          quantity, or bring the material in first.
        </p>
      )}
      {tooSmall.length > 0 && (
        <p role="alert" className="text-sm text-red-700">
          At this quantity {tooSmall.map((line) => line.itemName).join(', ')}{' '}
          comes to less than 0.001. Issue a larger quantity.
        </p>
      )}
    </div>
  );
}
