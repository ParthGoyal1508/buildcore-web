'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createAsset,
  getNextAssetCode,
  updateAsset,
  type Asset,
  type AssetInput,
} from '@/app/lib/api/assets';
import {
  MESSAGES,
  ROUTES,
  SETTABLE_ASSET_STATUSES,
  assetsLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import {
  useAssetCategories,
  useAssetSites,
  useAssetVendors,
  useAssetsCompanyId,
  useConditionGrades,
} from './use-asset-refs';

/**
 * Register or edit an asset (spec US2).
 *
 * The form's shape follows the selected category's tracking mode and never shows both
 * halves at once (spec FR-006): a serialised category offers Serial Number, a bulk one
 * offers Quantity and Unit. Showing both and validating afterwards would invite
 * someone to fill in a field that is about to be rejected.
 *
 * Three fields are create-only, and the code is never typed (2026-10-15): it is built
 * from the name and the manufacturing year in the company's format, shown before saving, and
 * never renamed — every allocation hangs off it. Category is fixed because the tracking mode, depreciation policy and
 * inspection schedule were all taken from it. Site is fixed because an asset moves
 * through a transfer, never through an edit — a direct change would leave its per-site
 * stock pointing at the old location. The backend refuses all three; the form does not
 * offer them.
 */
export default function AssetModal({
  asset,
  onClose,
}: {
  asset?: Asset;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = useAssetsCompanyId();
  const categories = useAssetCategories();
  const sites = useAssetSites();
  const vendors = useAssetVendors();
  const grades = useConditionGrades();
  const isEdit = asset !== undefined;

  const [manufacturingYear, setManufacturingYear] = useState(
    asset?.manufacturingYear ? String(asset.manufacturingYear) : '',
  );
  const [name, setName] = useState(asset?.name ?? '');
  const [categoryId, setCategoryId] = useState(asset?.categoryId ?? '');
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer ?? '');
  const [modelNumber, setModelNumber] = useState(asset?.modelNumber ?? '');
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? '');
  const [quantity, setQuantity] = useState(asset?.quantity?.toString() ?? '1');
  const [unitOfMeasure, setUnitOfMeasure] = useState(
    asset?.unitOfMeasure ?? '',
  );
  const [purchaseDate, setPurchaseDate] = useState(
    asset?.purchaseDate?.slice(0, 10) ?? '',
  );
  const [purchaseCost, setPurchaseCost] = useState(
    asset?.purchaseCost?.toString() ?? '',
  );
  const [capitalisationDate, setCapitalisationDate] = useState(
    asset?.capitalisationDate?.slice(0, 10) ?? '',
  );
  const [salvageValue, setSalvageValue] = useState(
    asset?.salvageValue?.toString() ?? '',
  );
  const [vendorId, setVendorId] = useState(asset?.vendorId ?? '');
  const [currentSiteId, setCurrentSiteId] = useState(
    asset?.currentSiteId ?? '',
  );
  const [conditionGradeId, setConditionGradeId] = useState(
    asset?.currentConditionGradeId ?? '',
  );
  const [status, setStatus] = useState<string>(asset?.status ?? 'idle');
  const [error, setError] = useState<string | null>(null);
  /** The asset a duplicate serial already belongs to, so the 409 can be a link
   * rather than a dead end (spec T013). */
  const [duplicateCode, setDuplicateCode] = useState<string | null>(null);

  const category = (categories.data ?? []).find(
    (entry) => entry.id === categoryId,
  );
  // On an edit the asset carries its own copy, which is authoritative even if the
  // category has since been retired out of the picker.
  const trackingMode = asset?.trackingMode ?? category?.trackingMode;
  const isSerialised = trackingMode === 'serialised';
  const isBulk = trackingMode === 'bulk';

  // The same cross-field rule the backend enforces with a 400 (spec FR-019),
  // checked here so it lands under the field rather than in a banner.
  const capitalisationTooEarly =
    purchaseDate !== '' &&
    capitalisationDate !== '' &&
    capitalisationDate < purchaseDate;

  // The code this asset will be given, from the server's own builder (2026-10-15).
  const previewName = useDeferredValue(name.trim());
  const previewYear = useDeferredValue(
    /^\d{4}$/.test(manufacturingYear)
      ? Number(manufacturingYear)
      : purchaseDate
        ? Number(purchaseDate.slice(0, 4))
        : undefined,
  );
  const nextCode = useQuery({
    queryKey: ['assets', 'next-code', previewName, previewYear],
    queryFn: () => getNextAssetCode(previewName, previewYear),
    enabled: !isEdit && previewName.length > 0,
  });

  const save = useMutation({
    mutationFn: () => {
      const input: AssetInput = {
        name: name.trim(),
        categoryId,
        capitalisationDate,
        currentSiteId,
        ...(/^\d{4}$/.test(manufacturingYear)
          ? { manufacturingYear: Number(manufacturingYear) }
          : {}),
        ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {}),
        ...(modelNumber.trim() ? { modelNumber: modelNumber.trim() } : {}),
        ...(isSerialised && serialNumber.trim()
          ? { serialNumber: serialNumber.trim() }
          : {}),
        ...(isBulk && quantity ? { quantity: Number(quantity) } : {}),
        ...(isBulk && unitOfMeasure.trim()
          ? { unitOfMeasure: unitOfMeasure.trim() }
          : {}),
        ...(purchaseDate ? { purchaseDate } : {}),
        ...(purchaseCost ? { purchaseCost: Number(purchaseCost) } : {}),
        ...(salvageValue ? { salvageValue: Number(salvageValue) } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(conditionGradeId
          ? { currentConditionGradeId: conditionGradeId }
          : {}),
        ...(isEdit ? { status } : {}),
      };
      return isEdit
        ? updateAsset(asset.id, {
            // Category and site are never sent on an edit — see the header.
            ...input,
            categoryId: undefined,
            currentSiteId: undefined,
          } as Partial<AssetInput>)
        : createAsset(input, companyId ?? undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        // The API names the existing asset's code in the 409, which is the one
        // piece of information that turns "already registered" into an action.
        const match = /already registered as ([A-Za-z0-9-]+)/.exec(err.message);
        setDuplicateCode(match ? match[1] : null);
        return;
      }
      setError(MESSAGES.assetsSaveFailed);
      setDuplicateCode(null);
    },
  });

  const noCategories = categories.data?.length === 0;
  const canSubmit =
    name.trim() !== '' &&
    categoryId !== '' &&
    capitalisationDate !== '' &&
    currentSiteId !== '' &&
    !capitalisationTooEarly;

  return (
    <Modal
      title={isEdit ? `Edit ${asset.assetCode}` : 'Register an asset'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="asset-form"
            disabled={save.isPending || !canSubmit}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="asset-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setError(null);
          setDuplicateCode(null);
          save.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />
        {duplicateCode && (
          <p className="text-sm text-gray-700">
            That serial number belongs to{' '}
            <Link
              href={ROUTES.assetsRegister}
              className="text-brand-700 underline hover:text-brand-900"
            >
              {duplicateCode}
            </Link>
            . Search the register for it to check whether this is the same unit.
          </p>
        )}
        {noCategories && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {MESSAGES.assetsNoCategories}
          </p>
        )}

        {/* Never typed (2026-10-15): built from the name and the manufacturing year in the
            company's format from Settings → Numbering — `DR01/2024`. */}
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Asset code
          </span>
          <p className="flex min-h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900">
            {isEdit
              ? asset.assetCode
              : (nextCode.data ?? (name.trim() ? '…' : 'Enter the name'))}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {isEdit
              ? 'Given when the asset was registered; it does not change.'
              : 'Assigned automatically: letters from the name, a serial, the manufacturing year.'}
          </p>
        </div>

        <TextField
          id="asset-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={160}
        />

        <TextField
          id="asset-year"
          label="Manufacturing year"
          inputMode="numeric"
          maxLength={4}
          value={manufacturingYear}
          onChange={(event) =>
            setManufacturingYear(event.target.value.replace(/\D/g, ''))
          }
          placeholder={String(new Date().getFullYear())}
          hint={
            isEdit
              ? 'Recorded for reference; the code was set at registration.'
              : 'The last part of the code. Blank uses the purchase year, else this year.'
          }
        />

        {isEdit ? (
          <TextField
            id="asset-category-locked"
            label="Category"
            value={asset.categoryName}
            readOnly
            disabled
            hint="Fixed: the tracking mode, depreciation policy and inspection schedule were all taken from it when the asset was registered."
          />
        ) : (
          <SelectField
            id="asset-category"
            label="Category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            hint="Decides whether this asset is one identified unit or a pool of units."
          >
            <option value="">Select a category</option>
            {(categories.data ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} — {assetsLabel(entry.trackingMode)}
              </option>
            ))}
          </SelectField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="asset-manufacturer"
            label="Manufacturer"
            value={manufacturer}
            onChange={(event) => setManufacturer(event.target.value)}
            maxLength={120}
          />
          <TextField
            id="asset-model"
            label="Model number"
            value={modelNumber}
            onChange={(event) => setModelNumber(event.target.value)}
            maxLength={120}
          />
        </div>

        {/* Serialised and bulk are never both on screen (spec FR-006). */}
        {isSerialised && (
          <TextField
            id="asset-serial"
            label="Serial number"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            maxLength={120}
            hint="Unique across the company. One row is one physical unit — register each unit separately."
          />
        )}

        {isBulk && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="asset-quantity"
              label="Quantity"
              type="number"
              min={0.001}
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              hint="The registered pool. Where the units are is tracked per site."
            />
            <TextField
              id="asset-unit"
              label="Unit of measure"
              value={unitOfMeasure}
              onChange={(event) => setUnitOfMeasure(event.target.value)}
              maxLength={20}
              placeholder="NOS, M, SQM"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="asset-purchase-date"
            label="Purchase date"
            type="date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
          />
          <TextField
            id="asset-capitalisation-date"
            label="Capitalisation date"
            type="date"
            value={capitalisationDate}
            onChange={(event) => setCapitalisationDate(event.target.value)}
            required
            error={
              capitalisationTooEarly
                ? 'Cannot be before the purchase date — the asset would start losing value before it was owned.'
                : undefined
            }
            hint="When the asset starts depreciating. A future date registers it as not in service until then."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="asset-cost"
            label="Purchase cost"
            type="number"
            min={0}
            step="0.01"
            value={purchaseCost}
            onChange={(event) => setPurchaseCost(event.target.value)}
          />
          <TextField
            id="asset-salvage"
            label="Salvage value"
            type="number"
            min={0}
            step="0.01"
            value={salvageValue}
            onChange={(event) => setSalvageValue(event.target.value)}
            hint="What it is still worth at the end of its life. Its value never falls below this."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="asset-vendor"
            label="Supplier"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
          >
            <option value="">Not recorded</option>
            {(vendors.data ?? []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </SelectField>

          {isEdit ? (
            <TextField
              id="asset-site-locked"
              label="Site"
              value={asset.siteName}
              readOnly
              disabled
              hint="An asset moves site through a transfer, so its per-site quantities move with it."
            />
          ) : (
            <SelectField
              id="asset-site"
              label="Site"
              value={currentSiteId}
              onChange={(event) => setCurrentSiteId(event.target.value)}
              required
            >
              <option value="">Select a site</option>
              {(sites.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="asset-condition"
            label="Condition"
            value={conditionGradeId}
            onChange={(event) => setConditionGradeId(event.target.value)}
          >
            <option value="">Not graded</option>
            {(grades.data ?? []).map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </SelectField>

          {isEdit && (
            <SelectField
              id="asset-status"
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              hint="Allocated and In transit are set by allocating and transferring — they move the quantities behind them too."
            >
              {SETTABLE_ASSET_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {assetsLabel(value)}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </form>
    </Modal>
  );
}
