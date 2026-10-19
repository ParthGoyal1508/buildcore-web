'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createAllocation,
  getAssetStock,
  type Asset,
} from '@/app/lib/api/assets';
import { errorMessage } from '@/app/lib/api/client';
import { MESSAGES, formatAssetQuantity } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  EmployeePicker,
  ProjectPicker,
  SitePicker,
} from '@/app/ui/plant/pickers';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import { useAssetCategories, useAssetsCompanyId } from './use-asset-refs';
import { todayIso } from '@/app/lib/format';

/**
 * Allocate an asset to a project site (spec US4).
 *
 * Two things here are deliberately not client-side arithmetic:
 *
 * 1. **Availability** is read from the stock endpoint each time the site changes,
 *    never from a cached register row (spec FR-008). A quantity check against a
 *    stale figure is how two people both allocate the last four units — the backend
 *    holds a row lock that catches it either way, but a hint computed from a cache
 *    tells the second person they can have something they cannot.
 * 2. **The custody rule** is the category's, not this form's. The custodian field
 *    appears when the category requires one, and a custodian posted at another site
 *    is refused by the backend with a 400 that this form shows *on the Custodian
 *    field* rather than in a banner, because that is the field to change.
 *
 * 036 L2: project, site and custodian are server-searched pickers. The custodian list was a plain
 * select capped at 100 people, so the 101st person posted at a site could not be given custody.
 */
export default function AllocateModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useAssetsCompanyId();
  const categories = useAssetCategories();

  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState(asset.currentSiteId);
  const [custodianEmployeeId, setCustodianEmployeeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [allocatedFrom, setAllocatedFrom] = useState(
    todayIso(),
  );
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [custodianError, setCustodianError] = useState<string | null>(null);

  const isBulk = asset.trackingMode === 'bulk';
  const category = (categories.data ?? []).find(
    (entry) => entry.id === asset.categoryId,
  );
  const custodyRequired = category?.custodyRequired ?? false;

  // Live, per site, and re-read whenever the site changes — never computed from the
  // register row already on screen.
  const stock = useQuery({
    queryKey: ['assets', 'stock', asset.id, siteId, companyId],
    queryFn: () =>
      getAssetStock({
        assetId: asset.id,
        siteId,
        ...(companyId ? { companyId } : {}),
      }),
    enabled: siteId !== '',
  });
  const available = stock.data?.[0]?.onHand ?? 0;
  const exceedsAvailable = isBulk && Number(quantity || 0) > available;

  const isDirty =
    projectId !== '' ||
    custodianEmployeeId !== '' ||
    expectedReturnDate !== '' ||
    remarks.trim() !== '';

  const allocate = useMutation({
    mutationFn: () =>
      createAllocation(
        {
          assetId: asset.id,
          projectId,
          siteId,
          ...(custodianEmployeeId ? { custodianEmployeeId } : {}),
          ...(isBulk ? { quantity: Number(quantity) } : {}),
          allocatedFrom,
          expectedReturnDate,
          ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
        },
        companyId ?? undefined,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success(`${asset.assetCode} allocated.`);
      onClose();
    },
    onError: (err) => {
      const message = errorMessage(err, MESSAGES.saveFailed);
      // The one refusal that names a specific field. Routing it there rather than
      // to the banner is the difference between "something is wrong" and "change
      // this".
      if (/custody|posted at/i.test(message)) {
        setCustodianError(message);
        setError(null);
        return;
      }
      setError(message);
      setCustodianError(null);
    },
  });

  const canSubmit =
    projectId !== '' &&
    siteId !== '' &&
    expectedReturnDate !== '' &&
    (!custodyRequired || custodianEmployeeId !== '') &&
    !exceedsAvailable &&
    (!isBulk || Number(quantity) > 0);

  return (
    <Modal
      title={`Allocate ${asset.assetCode}`}
      onClose={onClose}
      wide
      isDirty={isDirty}
      pending={allocate.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="allocate-form"
            loading={allocate.isPending}
            disabled={!canSubmit}
          >
            Allocate
          </Button>
        </>
      }
    >
      <form
        id="allocate-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setError(null);
          setCustodianError(null);
          allocate.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />

        <ProjectPicker
          id="allocate-project"
          label="Project"
          required
          value={projectId}
          onChange={(id) => {
            setProjectId(id);
            setSiteId('');
            setCustodianEmployeeId('');
          }}
        />

        {/* Sites of the chosen project only: the backend refuses a site that belongs
            elsewhere, because the allocation would report cost against a project the asset
            never went to. */}
        <SitePicker
          id="allocate-site"
          label="Site"
          required
          projectId={projectId || undefined}
          disabled={projectId === ''}
          value={siteId}
          selectedOption={
            siteId === asset.currentSiteId
              ? { id: asset.currentSiteId, label: asset.siteName }
              : undefined
          }
          onChange={(id) => {
            setSiteId(id);
            setCustodianEmployeeId('');
          }}
          hint={
            projectId === ''
              ? 'Choose the project first.'
              : asset.trackingMode === 'serialised'
                ? `${asset.assetCode} is at ${asset.siteName}. Transfer it before allocating it elsewhere.`
                : undefined
          }
        />

        {isBulk && (
          <TextField
            id="allocate-quantity"
            label="Quantity"
            type="number"
            min={0.001}
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
            error={
              exceedsAvailable
                ? `Only ${formatAssetQuantity(available, asset.unitOfMeasure)} available at this site right now.`
                : undefined
            }
            hint={
              stock.isPending && siteId
                ? 'Checking availability…'
                : `${formatAssetQuantity(available, asset.unitOfMeasure)} available here.`
            }
          />
        )}

        {custodyRequired && (
          // Only employees posted at the chosen site can hold custody, so the picker is
          // narrowed to them rather than left to fail on submit.
          <EmployeePicker
            id="allocate-custodian"
            label="Custodian"
            required
            siteId={siteId || undefined}
            disabled={siteId === ''}
            value={custodianEmployeeId}
            onChange={(id) => {
              setCustodianEmployeeId(id);
              setCustodianError(null);
            }}
            error={custodianError ?? undefined}
            hint={`${category?.name ?? 'This category'} requires somebody to be accountable for the asset while it is out. Only people posted at this site can hold it.`}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="allocate-from"
            label="Allocated from"
            type="date"
            value={allocatedFrom}
            onChange={(event) => setAllocatedFrom(event.target.value)}
            required
          />
          <TextField
            id="allocate-due"
            label="Expected back by"
            type="date"
            min={allocatedFrom || undefined}
            value={expectedReturnDate}
            onChange={(event) => setExpectedReturnDate(event.target.value)}
            required
            hint="What the overdue marker is measured against."
          />
        </div>

        <TextField
          id="allocate-remarks"
          label="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          maxLength={500}
        />
      </form>
    </Modal>
  );
}
