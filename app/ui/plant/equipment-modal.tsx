'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createEquipment,
  updateEquipment,
  type Equipment,
  type EquipmentInput,
} from '@/app/lib/api/plant';
import {
  EQUIPMENT_OWNERSHIPS,
  MESSAGES,
  POWER_SOURCES,
  SETTABLE_EQUIPMENT_STATUSES,
  plantLabel,
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
  usePlantCategories,
  usePlantCompanyId,
  usePlantSites,
  usePlantVendors,
} from './use-plant-refs';

/**
 * Add or edit a machine.
 *
 * Two things are deliberately absent. `code` is only offered on create — it is what
 * the yard knows the machine by and what every logbook entry, fuel entry and hire
 * bill hangs off, so renaming it would detach a machine from its own history.
 * `under_maintenance` is not in the status list at all: the backend refuses it
 * (006 FR-002), and offering an option that always fails is worse than not offering
 * it. The hint under the field says so rather than leaving it a mystery.
 */
export default function EquipmentModal({
  equipment,
  onClose,
}: {
  equipment?: Equipment;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const categories = usePlantCategories();
  const vendors = usePlantVendors();
  const sites = usePlantSites();
  const isEdit = equipment !== undefined;

  const [code, setCode] = useState(equipment?.code ?? '');
  const [name, setName] = useState(equipment?.name ?? '');
  const [categoryId, setCategoryId] = useState(equipment?.categoryId ?? '');
  const [ownership, setOwnership] = useState<string>(
    equipment?.ownership ?? 'owned',
  );
  const [vendorId, setVendorId] = useState(equipment?.vendorId ?? '');
  const [powerSource, setPowerSource] = useState<string>(
    equipment?.powerSource ?? 'diesel',
  );
  const [purchaseDate, setPurchaseDate] = useState(
    equipment?.purchaseDate?.slice(0, 10) ?? '',
  );
  const [purchaseCost, setPurchaseCost] = useState(
    equipment?.purchaseCost?.toString() ?? '',
  );
  const [depreciationRate, setDepreciationRate] = useState(
    equipment?.depreciationRate?.toString() ?? '',
  );
  const [deployedSiteId, setDeployedSiteId] = useState(
    equipment?.deployedSiteId ?? '',
  );
  const [currentReading, setCurrentReading] = useState('');
  const [status, setStatus] = useState<string>(
    equipment?.status === 'under_maintenance'
      ? 'active'
      : (equipment?.status ?? 'active'),
  );
  const [error, setError] = useState<string | null>(null);

  const isHired = ownership === 'hired';
  const isOwned = ownership === 'owned';
  const underMaintenance = equipment?.status === 'under_maintenance';

  const save = useMutation({
    mutationFn: (input: EquipmentInput) =>
      isEdit
        ? updateEquipment(equipment.id, input)
        : createEquipment(input, companyId ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    save.mutate({
      ...(isEdit ? {} : code.trim() ? { code: code.trim() } : {}),
      name: name.trim(),
      categoryId,
      ownership,
      ...(isHired && vendorId ? { vendorId } : {}),
      powerSource,
      ...(isOwned && purchaseDate ? { purchaseDate } : {}),
      ...(isOwned && purchaseCost ? { purchaseCost: Number(purchaseCost) } : {}),
      ...(isOwned && depreciationRate
        ? { depreciationRate: Number(depreciationRate) }
        : {}),
      ...(deployedSiteId ? { deployedSiteId } : {}),
      ...(!isEdit && currentReading
        ? { currentReading: Number(currentReading) }
        : {}),
      ...(isEdit && !underMaintenance ? { status } : {}),
    });
  }

  const noCategories = categories.data?.length === 0;

  return (
    <Modal
      title={isEdit ? `Edit ${equipment.code}` : 'Register a machine'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="equipment-form"
            disabled={save.isPending || noCategories}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="equipment-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />
        {noCategories && <FormError message={MESSAGES.plantNoCategories} />}

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <TextField
              id="equipment-code"
              label="Code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              hint="The plate or asset number. Leave blank to have one allocated."
            />
          )}

          <TextField
            id="equipment-name"
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <SelectField
            id="equipment-category"
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

          <SelectField
            id="equipment-ownership"
            label="Ownership"
            required
            value={ownership}
            onChange={(event) => {
              setOwnership(event.target.value);
              // Clearing here rather than in an effect: a machine changed from
              // hired to owned keeping a vendor would raise hire bills against a
              // machine nobody rents.
              if (event.target.value !== 'hired') setVendorId('');
            }}
          >
            {EQUIPMENT_OWNERSHIPS.map((value) => (
              <option key={value} value={value}>
                {plantLabel(value)}
              </option>
            ))}
          </SelectField>

          {isHired && (
            <SelectField
              id="equipment-vendor"
              label="Hire vendor"
              required
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
            >
              <option value="">Select a vendor</option>
              {(vendors.data ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField
            id="equipment-power"
            label="Power source"
            required
            value={powerSource}
            onChange={(event) => setPowerSource(event.target.value)}
          >
            {POWER_SOURCES.map((value) => (
              <option key={value} value={value}>
                {plantLabel(value)}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="equipment-site"
            label="Deployed at"
            value={deployedSiteId}
            onChange={(event) => setDeployedSiteId(event.target.value)}
          >
            <option value="">Not deployed</option>
            {(sites.data ?? []).map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </SelectField>

          {isOwned && (
            <>
              <TextField
                id="equipment-purchase-date"
                label="Purchase date"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
              <TextField
                id="equipment-purchase-cost"
                label="Purchase cost (₹)"
                type="number"
                min={0}
                step="0.01"
                value={purchaseCost}
                onChange={(event) => setPurchaseCost(event.target.value)}
              />
              <TextField
                id="equipment-depreciation"
                label="Depreciation rate (% p.a.)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={depreciationRate}
                onChange={(event) => setDepreciationRate(event.target.value)}
                hint="Straight-line. Feeds the machinery cost a project reports."
              />
            </>
          )}

          {!isEdit && (
            <TextField
              id="equipment-reading"
              label="Opening meter reading"
              type="number"
              min={0}
              step="0.001"
              value={currentReading}
              onChange={(event) => setCurrentReading(event.target.value)}
              hint="Where the meter stands today. Defaults to 0."
            />
          )}

          {isEdit && (
            <SelectField
              id="equipment-status"
              label="Status"
              value={underMaintenance ? 'under_maintenance' : status}
              disabled={underMaintenance}
              onChange={(event) => setStatus(event.target.value)}
              hint={
                underMaintenance
                  ? 'Close the open maintenance job to return this machine to service.'
                  : MESSAGES.plantStatusLocked
              }
            >
              {underMaintenance ? (
                <option value="under_maintenance">Under Maintenance</option>
              ) : (
                SETTABLE_EQUIPMENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {plantLabel(value)}
                  </option>
                ))
              )}
            </SelectField>
          )}
        </div>
      </form>
    </Modal>
  );
}
