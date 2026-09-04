'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createEquipmentCategory,
  createEquipmentDocType,
  createHireRate,
  updateEquipmentCategory,
  updateEquipmentDocType,
  type EquipmentCategory,
  type EquipmentDocType,
} from '@/app/lib/api/plant';
import { METER_TYPES, MESSAGES, plantLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { usePlantCategories, usePlantCompanyId } from './use-plant-refs';

/**
 * Add or edit an equipment category.
 *
 * The two numbers here are the reason this master exists rather than the hardcoded
 * literals the original spec carried: a fuel variance threshold and a monthly hours
 * target are properties of a *kind of machine*, and a tower crane and a tipper do
 * not deserve the same tolerance.
 */
export function CategoryModal({
  category,
  onClose,
}: {
  category?: EquipmentCategory;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const isEdit = category !== undefined;

  const [name, setName] = useState(category?.name ?? '');
  const [meterType, setMeterType] = useState<string>(
    category?.meterType ?? 'hours',
  );
  const [fuelBenchmark, setFuelBenchmark] = useState(
    category?.fuelBenchmark === null || category?.fuelBenchmark === undefined
      ? ''
      : String(category.fuelBenchmark),
  );
  const [threshold, setThreshold] = useState(
    String(category?.fuelVarianceThresholdPercent ?? 15),
  );
  const [targetHours, setTargetHours] = useState(
    String(category?.targetHoursPerMonth ?? 176),
  );
  const [active, setActive] = useState(category?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        meterType,
        ...(fuelBenchmark ? { fuelBenchmark: Number(fuelBenchmark) } : {}),
        fuelVarianceThresholdPercent: Number(threshold),
        targetHoursPerMonth: Number(targetHours),
      };
      return isEdit
        ? updateEquipmentCategory(category.id, { ...body, active })
        : createEquipmentCategory(body, companyId ?? undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title={isEdit ? `Edit ${category.name}` : 'Add an equipment category'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <TextField
          id="category-name"
          label="Name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <SelectField
          id="category-meter"
          label="Meter type"
          required
          value={meterType}
          onChange={(event) => setMeterType(event.target.value)}
          hint="What machines in this category count: running hours, or kilometres."
        >
          {METER_TYPES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="category-benchmark"
            label="Fuel benchmark"
            type="number"
            min={0}
            step="0.001"
            value={fuelBenchmark}
            onChange={(event) => setFuelBenchmark(event.target.value)}
            hint={
              meterType === 'km'
                ? 'Litres per kilometre. Leave blank rather than guess — an unset benchmark computes no variance, a wrong one flags every entry.'
                : 'Litres per hour. Leave blank rather than guess — an unset benchmark computes no variance, a wrong one flags every entry.'
            }
          />
          <TextField
            id="category-threshold"
            label="Variance threshold (%)"
            type="number"
            min={0}
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            hint="How far past the benchmark a day may run before it is flagged."
          />
        </div>

        <TextField
          id="category-target"
          label="Target hours per month"
          type="number"
          min={1}
          value={targetHours}
          onChange={(event) => setTargetHours(event.target.value)}
          hint="The denominator for utilisation %. 176 is 22 working days × 8 hours."
        />

        {isEdit && (
          <CheckboxField
            id="category-active"
            label="Active"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        )}
      </form>
    </Modal>
  );
}

/** Add or edit an equipment document type. */
export function DocTypeModal({
  docType,
  onClose,
}: {
  docType?: EquipmentDocType;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const isEdit = docType !== undefined;

  const [name, setName] = useState(docType?.name ?? '');
  const [alertDays, setAlertDays] = useState(String(docType?.alertDays ?? 30));
  const [active, setActive] = useState(docType?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), alertDays: Number(alertDays) };
      return isEdit
        ? updateEquipmentDocType(docType.id, { ...body, active })
        : createEquipmentDocType(body, companyId ?? undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
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
          <Button type="submit" form="doctype-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="doctype-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <TextField
          id="doctype-name"
          label="Name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <TextField
          id="doctype-alert"
          label="Alert days"
          type="number"
          required
          min={0}
          max={365}
          value={alertDays}
          onChange={(event) => setAlertDays(event.target.value)}
          hint="How long before expiry the register flags a document of this type. An insurance policy wants more notice than a pollution certificate."
        />

        {isEdit && (
          <CheckboxField
            id="doctype-active"
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
 * Add a hire rate.
 *
 * There is no edit. A rate is a fact about a period, and editing one would
 * retroactively reprice every hire bill raised under it — the exact thing the
 * effective-dated timeline exists to prevent. Change the rate by adding a new one
 * from the date it takes effect; the prior rate closes automatically.
 */
export function HireRateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const categories = usePlantCategories();

  const [categoryId, setCategoryId] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      createHireRate(
        {
          categoryId,
          ratePerUnit: Number(ratePerUnit),
          effectiveFrom,
        },
        companyId ?? undefined,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title="Add a hire rate"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="rate-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="rate-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <SelectField
          id="rate-category"
          label="Category"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Select a category</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="rate-value"
          label="Rate per unit (₹)"
          type="number"
          required
          min={0}
          step="0.01"
          value={ratePerUnit}
          onChange={(event) => setRatePerUnit(event.target.value)}
        />

        <TextField
          id="rate-from"
          label="Effective from"
          type="date"
          required
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          hint="The rate currently in force is closed the day before this date, so the timeline never overlaps. Bills for earlier periods keep resolving the older rate."
        />
      </form>
    </Modal>
  );
}
