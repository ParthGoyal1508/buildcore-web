'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import clsx from 'clsx';

import { ApiError } from '@/app/lib/api/client';
import {
  VendorDetail,
  createVendor,
  getVendorCategories,
  updateVendor,
} from '@/app/lib/api/partners';
import {
  CONTRACTOR_VENDOR_TYPES,
  MESSAGES,
  VENDOR_TYPES,
  partnersLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import {
  vendorFormSchema,
  type VendorFormValues,
} from '@/app/ui/partners/vendor-form-schema';

const TABS = ['Details', 'Address', 'Contacts', 'Work detail'] as const;
type Tab = (typeof TABS)[number];

/**
 * Add/Edit vendor.
 *
 * **One `react-hook-form` instance for all four tabs**, not one per tab (FR-011).
 * Switching tabs only changes which fields are rendered — the form state is
 * untouched, so a half-filled Contacts tab survives a trip to Address and back.
 * Per-tab forms would lose it, and the loss would be silent.
 *
 * Contacts and category tags are sent as complete arrays because the backend
 * replaces them wholesale. That is why the form always submits the full list rather
 * than a diff.
 */
export default function VendorModal({
  vendor,
  onClose,
}: {
  vendor: VendorDetail | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Details');
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['partners', 'vendor-categories'],
    queryFn: getVendorCategories,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: vendor?.name ?? '',
      type: vendor?.type ?? 'material',
      gstin: vendor?.gstin ?? '',
      pan: vendor?.pan ?? '',
      tdsSection: vendor?.tdsSection ?? '',
      tdsRate: vendor?.tdsRate ?? undefined,
      active: vendor?.active ?? true,
      address: vendor?.address ?? '',
      city: vendor?.city ?? '',
      state: vendor?.state ?? '',
      pinCode: vendor?.pinCode ?? '',
      categoryIds: vendor?.categoryIds ?? [],
      contacts:
        vendor?.contacts.map((contact) => ({
          name: contact.name,
          phone: contact.phone ?? '',
          email: contact.email ?? '',
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });

  // `useWatch`, not `watch()`. The React Compiler lint rule rejects `watch()`
  // outright — it returns a function that cannot be memoized safely, so the compiler
  // skips optimising the whole component and stale values can leak into anything
  // memoized downstream. Feature 005 hit the same rule.
  const selectedType = useWatch({ control, name: 'type' });
  const supportsHire = CONTRACTOR_VENDOR_TYPES.includes(selectedType) ||
    selectedType === 'hire';

  const mutation = useMutation({
    mutationFn: (values: VendorFormValues) => {
      const parsed = vendorFormSchema.parse(values);
      const payload = {
        ...parsed,
        contacts: parsed.contacts,
        categoryIds: parsed.categoryIds,
      };
      return vendor ? updateVendor(vendor.id, payload) : createVendor(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', 'vendors'] });
      onClose();
    },
    onError: (error: unknown) => {
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      );
    },
  });

  return (
    <Modal
      title={vendor ? `Edit ${vendor.name}` : 'Add vendor'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="vendor-form"
            disabled={isSubmitting || mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="vendor-form"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
        className="space-y-4"
      >
        {serverError && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div role="tablist" aria-label="Vendor details" className="flex gap-1 border-b border-gray-200">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={clsx(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                tab === name
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Every tab stays mounted and is hidden with `hidden`, rather than being
            unmounted. Unmounting would drop the inputs' registration and, with it,
            anything typed on a tab the user has navigated away from (FR-011). */}
        <div className={clsx('grid gap-4 sm:grid-cols-2', tab !== 'Details' && 'hidden')}>
          <Field id="vendor-name" label="Vendor name" error={errors.name?.message}>
            <TextInput id="vendor-name" {...register('name')} />
          </Field>
          <Field id="vendor-type" label="Type" error={errors.type?.message}>
            <SelectInput id="vendor-type" {...register('type')}>
              {VENDOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {partnersLabel(type)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field
            id="vendor-gstin"
            label="GSTIN"
            error={errors.gstin?.message}
            hint="15 characters, e.g. 27AAPFU0939F1ZV"
          >
            <TextInput id="vendor-gstin" {...register('gstin')} />
          </Field>
          <Field id="vendor-pan" label="PAN" error={errors.pan?.message}>
            <TextInput id="vendor-pan" {...register('pan')} />
          </Field>
          <Field
            id="vendor-tds-section"
            label="TDS section"
            error={errors.tdsSection?.message}
            hint="Free text — the Act's section list changes between finance acts"
          >
            <TextInput id="vendor-tds-section" {...register('tdsSection')} />
          </Field>
          <Field id="vendor-tds-rate" label="TDS rate (%)" error={errors.tdsRate?.message}>
            <TextInput
              id="vendor-tds-rate"
              type="number"
              step="0.01"
              {...register('tdsRate')}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-medium text-gray-700">Deals in</legend>
            <div className="flex flex-wrap gap-3">
              {(categories ?? []).map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    value={category.id}
                    {...register('categoryIds')}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  />
                  {category.name}
                </label>
              ))}
              {(categories ?? []).length === 0 && (
                <p className="text-sm text-gray-500">
                  No categories yet — add them under Categories first.
                </p>
              )}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              {...register('active')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            />
            Active
          </label>
        </div>

        <div className={clsx('grid gap-4 sm:grid-cols-2', tab !== 'Address' && 'hidden')}>
          <Field id="vendor-address" label="Address" error={errors.address?.message}>
            <TextInput id="vendor-address" {...register('address')} />
          </Field>
          <Field id="vendor-city" label="City" error={errors.city?.message}>
            <TextInput id="vendor-city" {...register('city')} />
          </Field>
          <Field id="vendor-state" label="State" error={errors.state?.message}>
            <TextInput id="vendor-state" {...register('state')} />
          </Field>
          <Field id="vendor-pin" label="PIN code" error={errors.pinCode?.message}>
            <TextInput id="vendor-pin" {...register('pinCode')} />
          </Field>
        </div>

        <div className={clsx('space-y-3', tab !== 'Contacts' && 'hidden')}>
          {fields.length === 0 && (
            <p className="text-sm text-gray-500">No contacts yet.</p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field
                id={`contact-name-${index}`}
                label="Name"
                error={errors.contacts?.[index]?.name?.message}
              >
                <TextInput
                  id={`contact-name-${index}`}
                  {...register(`contacts.${index}.name`)}
                />
              </Field>
              <Field id={`contact-phone-${index}`} label="Phone">
                <TextInput
                  id={`contact-phone-${index}`}
                  {...register(`contacts.${index}.phone`)}
                />
              </Field>
              <Field
                id={`contact-email-${index}`}
                label="Email"
                error={errors.contacts?.[index]?.email?.message}
              >
                <TextInput
                  id={`contact-email-${index}`}
                  {...register(`contacts.${index}.email`)}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <SecondaryButton
            type="button"
            onClick={() => append({ name: '', phone: '', email: '' })}
          >
            Add contact
          </SecondaryButton>
          <p className="text-xs text-gray-500">
            Saving replaces the vendor’s stored contacts with exactly this list.
          </p>
        </div>

        <div className={clsx('space-y-3', tab !== 'Work detail' && 'hidden')}>
          {supportsHire ? (
            <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              Hire and contract terms for this vendor are recorded on the vendor
              record. Detailed hire terms are not editable from this screen yet.
            </p>
          ) : (
            <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              Work detail applies to hire, subcontractor and labour-contractor
              vendors. This vendor is a {partnersLabel(selectedType).toLowerCase()}{' '}
              vendor, so there is nothing to record here.
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
