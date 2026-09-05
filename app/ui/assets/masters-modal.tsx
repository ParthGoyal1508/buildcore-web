'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createAssetCategory,
  createAssetDocType,
  createConditionGrade,
  updateAssetCategory,
  updateAssetDocType,
  updateConditionGrade,
  type AssetCategory,
  type AssetDocType,
  type ConditionGrade,
} from '@/app/lib/api/assets';
import {
  ASSET_TRACKING_MODES,
  MESSAGES,
  assetsLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useAssetsCompanyId } from './use-asset-refs';

/**
 * Add or edit an asset category (spec US1).
 *
 * The one field that behaves differently from every other master form is
 * `trackingMode`: it becomes read-only the moment an asset exists under the category
 * (spec FR-003, backend 409). Read-only with the reason on screen rather than absent
 * — an administrator who cannot find the field assumes it is a bug, and one who is
 * told the mode is fixed by the assets already registered knows what to do instead.
 */
export function CategoryModal({
  category,
  onClose,
}: {
  category?: AssetCategory;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = useAssetsCompanyId();
  const isEdit = category !== undefined;
  // The API returns the count with the category, so this needs no second request.
  const modeLocked = (category?.assetCount ?? 0) > 0;

  const [name, setName] = useState(category?.name ?? '');
  const [trackingMode, setTrackingMode] = useState<string>(
    category?.trackingMode ?? 'serialised',
  );
  const [depreciationRatePercent, setDepreciationRatePercent] = useState(
    category?.depreciationRatePercent?.toString() ?? '',
  );
  const [usefulLifeYears, setUsefulLifeYears] = useState(
    category?.usefulLifeYears?.toString() ?? '',
  );
  const [custodyRequired, setCustodyRequired] = useState(
    category?.custodyRequired ?? false,
  );
  const [inspectionRequired, setInspectionRequired] = useState(
    category?.inspectionRequired ?? false,
  );
  const [inspectionIntervalDays, setInspectionIntervalDays] = useState(
    category?.inspectionIntervalDays?.toString() ?? '',
  );
  const [repairCostThresholdPercent, setRepairCostThresholdPercent] = useState(
    category?.repairCostThresholdPercent?.toString() ?? '',
  );
  const [active, setActive] = useState(category?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  // The same pairing the backend enforces with a 400, checked here so the message
  // lands under the field rather than in a banner after a round trip.
  const intervalMissing = inspectionRequired && !inspectionIntervalDays.trim();

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        ...(isEdit && modeLocked ? {} : { trackingMode }),
        ...(depreciationRatePercent
          ? { depreciationRatePercent: Number(depreciationRatePercent) }
          : {}),
        ...(usefulLifeYears
          ? { usefulLifeYears: Number(usefulLifeYears) }
          : {}),
        custodyRequired,
        inspectionRequired,
        ...(inspectionRequired && inspectionIntervalDays
          ? { inspectionIntervalDays: Number(inspectionIntervalDays) }
          : {}),
        ...(repairCostThresholdPercent
          ? {
              repairCostThresholdPercent: Number(repairCostThresholdPercent),
            }
          : {}),
        ...(isEdit ? { active } : {}),
      };
      return isEdit
        ? updateAssetCategory(category.id, input)
        : createAssetCategory(input, companyId ?? undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (intervalMissing) return;
    setError(null);
    save.mutate();
  }

  return (
    <Modal
      title={isEdit ? `Edit ${category.name}` : 'Add an asset category'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="asset-category-form"
            disabled={save.isPending || !name.trim() || intervalMissing}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="asset-category-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />

        <TextField
          id="asset-category-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
        />

        {modeLocked ? (
          <TextField
            id="asset-category-mode-locked"
            label="Tracking mode"
            value={assetsLabel(trackingMode)}
            readOnly
            disabled
            hint={`Fixed: ${category?.assetCount} asset(s) are registered under this category. The two modes track quantity differently, so changing it would reinterpret every one of them. Create a new category for the other mode.`}
          />
        ) : (
          <SelectField
            id="asset-category-mode"
            label="Tracking mode"
            value={trackingMode}
            onChange={(event) => setTrackingMode(event.target.value)}
            hint="Serialised: one row per physical unit, with a serial number and a custodian. Bulk: one row for the pool, with quantities held per site. Fixed once an asset is registered."
          >
            {ASSET_TRACKING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {assetsLabel(mode)}
              </option>
            ))}
          </SelectField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="asset-category-rate"
            label="Depreciation rate (% per year)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={depreciationRatePercent}
            onChange={(event) =>
              setDepreciationRatePercent(event.target.value)
            }
            hint="The default a new asset inherits. Each asset keeps its own copy, so changing this never restates one already registered."
          />
          <TextField
            id="asset-category-life"
            label="Useful life (years)"
            type="number"
            min={1}
            max={100}
            value={usefulLifeYears}
            onChange={(event) => setUsefulLifeYears(event.target.value)}
          />
        </div>

        <CheckboxField
          id="asset-category-custody"
          label="Custody required"
          description="An allocation must name a custodian, and that person must be posted at the allocation's site."
          checked={custodyRequired}
          onChange={(event) => setCustodyRequired(event.target.checked)}
        />

        <CheckboxField
          id="asset-category-inspection"
          label="Inspection required"
          description="Assets in this category carry a next-inspection date."
          checked={inspectionRequired}
          onChange={(event) => setInspectionRequired(event.target.checked)}
        />

        {inspectionRequired && (
          <TextField
            id="asset-category-interval"
            label="Inspection interval (days)"
            type="number"
            min={1}
            max={3650}
            value={inspectionIntervalDays}
            onChange={(event) => setInspectionIntervalDays(event.target.value)}
            required
            error={
              intervalMissing
                ? 'An inspection requirement needs an interval — without one there is no date to compute.'
                : undefined
            }
          />
        )}

        <TextField
          id="asset-category-repair-threshold"
          label="Repair cost threshold (% of purchase cost)"
          type="number"
          min={0}
          step="0.01"
          value={repairCostThresholdPercent}
          onChange={(event) =>
            setRepairCostThresholdPercent(event.target.value)
          }
          hint="Cumulative repair spend above this share of what the asset cost flags it for review."
        />

        {isEdit && (
          <CheckboxField
            id="asset-category-active"
            label="Active"
            description="Retire a category without deleting it — existing assets keep resolving its name."
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        )}
      </form>
    </Modal>
  );
}

/** Add or edit an asset document type. `alertDays` is per type for the reason the
 * backend model documents: an insurance policy and a calibration certificate are not
 * renewed on the same notice. */
export function DocTypeModal({
  docType,
  onClose,
}: {
  docType?: AssetDocType;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = useAssetsCompanyId();
  const isEdit = docType !== undefined;

  const [name, setName] = useState(docType?.name ?? '');
  const [alertDays, setAlertDays] = useState(
    docType?.alertDays?.toString() ?? '30',
  );
  const [active, setActive] = useState(docType?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        ...(alertDays ? { alertDays: Number(alertDays) } : {}),
        ...(isEdit ? { active } : {}),
      };
      return isEdit
        ? updateAssetDocType(docType.id, input)
        : createAssetDocType(input, companyId ?? undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  return (
    <Modal
      title={isEdit ? `Edit ${docType.name}` : 'Add a document type'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="asset-doc-type-form"
            disabled={save.isPending || !name.trim()}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="asset-doc-type-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />
        <TextField
          id="asset-doc-type-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
        />
        <TextField
          id="asset-doc-type-alert"
          label="Alert days before expiry"
          type="number"
          min={0}
          max={365}
          value={alertDays}
          onChange={(event) => setAlertDays(event.target.value)}
          hint="How much notice a document of this type gives before it lapses."
        />
        {isEdit && (
          <CheckboxField
            id="asset-doc-type-active"
            label="Active"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        )}
      </form>
    </Modal>
  );
}

/**
 * Add or edit a condition grade.
 *
 * The two checkboxes are the reason this is a master rather than an enum: they carry
 * behaviour. A return graded `isScrap` condemns the asset and a return graded
 * `isDamaged` sends it for repair (spec FR-012), so the helper text says so plainly —
 * an administrator ticking a box that quietly rewrites an asset's status deserves to
 * be told which one.
 */
export function ConditionGradeModal({
  grade,
  onClose,
}: {
  grade?: ConditionGrade;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = useAssetsCompanyId();
  const isEdit = grade !== undefined;

  const [name, setName] = useState(grade?.name ?? '');
  const [sequence, setSequence] = useState(grade?.sequence?.toString() ?? '');
  const [isDamaged, setIsDamaged] = useState(grade?.isDamaged ?? false);
  const [isScrap, setIsScrap] = useState(grade?.isScrap ?? false);
  const [active, setActive] = useState(grade?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  // The backend refuses both at once with a 400: a return at that grade would have
  // two destinations. Caught here so the message lands beside the boxes.
  const bothOutcomes = isDamaged && isScrap;

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        ...(sequence ? { sequence: Number(sequence) } : {}),
        isDamaged,
        isScrap,
        ...(isEdit ? { active } : {}),
      };
      return isEdit
        ? updateConditionGrade(grade.id, input)
        : createConditionGrade(
            { ...input, sequence: Number(sequence || 1) },
            companyId ?? undefined,
          );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  return (
    <Modal
      title={isEdit ? `Edit ${grade.name}` : 'Add a condition grade'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="condition-grade-form"
            disabled={
              save.isPending || !name.trim() || !sequence || bothOutcomes
            }
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="condition-grade-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (bothOutcomes) return;
          setError(null);
          save.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />
        <TextField
          id="condition-grade-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
        />
        <TextField
          id="condition-grade-sequence"
          label="Position on the ladder"
          type="number"
          min={1}
          max={999}
          value={sequence}
          onChange={(event) => setSequence(event.target.value)}
          required
          hint="Lower is better. Best-first is the order the return dropdown shows, and what a transfer receipt compares against to spot damage in transit."
        />
        <CheckboxField
          id="condition-grade-damaged"
          label="Returning at this grade sends the asset for repair"
          description="The asset lands in Under repair instead of going back on the shelf."
          checked={isDamaged}
          onChange={(event) => setIsDamaged(event.target.checked)}
        />
        <CheckboxField
          id="condition-grade-scrap"
          label="Returning at this grade condemns the asset"
          description="The asset is scrapped and leaves the available pool for good."
          checked={isScrap}
          onChange={(event) => setIsScrap(event.target.checked)}
        />
        {bothOutcomes && (
          <p className="text-xs text-red-600" role="alert">
            A grade cannot both send an asset for repair and condemn it — a return at
            that grade would have two destinations. Pick one.
          </p>
        )}
        {isEdit && (
          <CheckboxField
            id="condition-grade-active"
            label="Active"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        )}
      </form>
    </Modal>
  );
}
