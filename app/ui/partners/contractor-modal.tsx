'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createContractor, getVendors } from '@/app/lib/api/partners';
import { CONTRACTOR_VENDOR_TYPES, MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';

/**
 * Add a contractor profile to an existing vendor.
 *
 * The vendor picker is filtered to the two types the backend accepts. It refuses
 * the others with a 400, so offering them would be offering a choice that cannot
 * succeed — the filter is the difference between a form that guides and a form that
 * lets you fail.
 */
export default function ContractorModal({ onClose }: { onClose: () => void }) {
  const [vendorId, setVendorId] = useState('');
  const [fields, setFields] = useState({
    licenceNumber: '',
    pfRegistration: '',
    esicRegistration: '',
    bocwRegistration: '',
    insurancePolicyNumber: '',
  });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Two calls because the API filters by a single type. Both lists are small.
  const vendorQueries = useQuery({
    queryKey: ['partners', 'vendors', 'contractor-eligible'],
    queryFn: async () => {
      const pages = await Promise.all(
        CONTRACTOR_VENDOR_TYPES.map((type) =>
          getVendors({ type, active: true, pageSize: 200 }),
        ),
      );
      return pages
        .flatMap((page) => page.items)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      createContractor({
        vendorId,
        ...Object.fromEntries(
          Object.entries(fields).filter(([, value]) => value.trim() !== ''),
        ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
      onClose();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  const set = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal
      title="Add contractor"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="contractor-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="contractor-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!vendorId) {
            setError('Choose a vendor.');
            return;
          }
          mutation.mutate();
        }}
      >
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Field
          id="contractor-vendor"
          label="Vendor"
          hint="Only subcontractor and labour-contractor vendors can hold a compliance profile."
        >
          <SelectInput
            id="contractor-vendor"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
          >
            <option value="">Select a vendor…</option>
            {(vendorQueries.data ?? []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} ({vendor.code})
              </option>
            ))}
          </SelectInput>
        </Field>

        {vendorQueries.data?.length === 0 && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            No subcontractor or labour-contractor vendors exist yet. Create one on the
            Vendors screen first.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="licence" label="Labour licence number">
            <TextInput id="licence" value={fields.licenceNumber} onChange={set('licenceNumber')} />
          </Field>
          <Field id="pf-reg" label="PF registration">
            <TextInput id="pf-reg" value={fields.pfRegistration} onChange={set('pfRegistration')} />
          </Field>
          <Field id="esic-reg" label="ESIC registration">
            <TextInput id="esic-reg" value={fields.esicRegistration} onChange={set('esicRegistration')} />
          </Field>
          <Field id="bocw-reg" label="BOCW registration">
            <TextInput id="bocw-reg" value={fields.bocwRegistration} onChange={set('bocwRegistration')} />
          </Field>
          <Field id="insurance" label="Insurance policy number">
            <TextInput id="insurance" value={fields.insurancePolicyNumber} onChange={set('insurancePolicyNumber')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
