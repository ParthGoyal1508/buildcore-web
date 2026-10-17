'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  createIssue,
  getEquipmentChoices,
  getStockHint,
  type IssueInput,
} from '@/app/lib/api/inventory';
import { getSite } from '@/app/lib/api/projects';
import { MESSAGES } from '@/app/lib/constants';
import { quantity as formatQuantity, todayIso } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
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
  const itemId = item?.id ?? '';
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

  const available = hint.data?.inStock ?? null;
  const unit = hint.data?.unit ?? '';

  const exceedsOutstanding =
    outstandingQuantity !== undefined &&
    quantity !== '' &&
    Number(quantity) > outstandingQuantity;

  const save = useMutation({
    mutationFn: () =>
      createIssue({
        siteId,
        itemId,
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
        `${formatQuantity(Number(quantity))}${unit ? ` ${unit}` : ''} of ${item?.label ?? 'material'} issued`,
      );
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        // Against the quantity field, where the user can act on it — not as a page
        // banner that loses the connection to what was typed.
        setQuantityError(err.message);
        return;
      }
      setError(errorMessage(err, 'Could not record this issue.'));
    },
  });

  const ready =
    siteId &&
    itemId &&
    date &&
    Number(quantity) > 0 &&
    (issuedTo.trim() || vendorId) &&
    !exceedsOutstanding;

  return (
    <Modal
      title="Issue material"
      onClose={onClose}
      isDirty={Boolean(quantity || issuedTo || remarks || (!fixed && itemId))}
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
            // Only what this store actually holds (009 research.md §7).
            search={searchStoreStock(siteId)}
            cacheKey={['inventory', 'stock', 'search', companyId, siteId]}
            selectedOption={item}
            disabled={!siteId || fixed}
            placeholder={siteId ? 'Search this store’s stock' : 'Choose a store first'}
          />
        </div>

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
            available !== null
              ? MESSAGES.stockHint(available, unit)
              : itemId
                ? 'Checking available stock…'
                : undefined
          }
        />

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
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
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
