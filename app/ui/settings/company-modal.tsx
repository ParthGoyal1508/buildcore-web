'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/app/lib/api/client';
import { Company, createCompany, updateCompany } from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

// Same statutory formats the API validates against, checked here first so an
// obvious typo never costs a round trip.
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const optionalText = z.string().trim().optional().or(z.literal(''));
const rate = z.coerce.number().min(0).max(100);

/** Treats an untouched field as absent rather than as `0` — `z.coerce.number()`
 * turns '' into 0, which would silently save a 0% rate instead of deferring to the
 * API's configured default. */
const optionalNumber = <T extends z.ZodTypeAny>(inner: T) =>
  z.union([z.literal(''), inner]);

const schema = z.object({
  name: z.string().trim().min(1, 'Company name is required'),
  shortCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,10}$/, '2–10 letters, digits or hyphens'),
  status: z.enum(['active', 'inactive']),
  logoUrl: optionalText,
  gstin: optionalText.refine((v) => !v || GSTIN.test(v), 'Not a valid GSTIN'),
  pan: optionalText.refine((v) => !v || PAN.test(v), 'Not a valid PAN'),
  cin: optionalText,
  tan: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  pinCode: optionalText.refine((v) => !v || /^[0-9]{6}$/.test(v), 'Must be 6 digits'),
  pfEstablishmentCode: optionalText,
  esicCode: optionalText,
  professionalTaxRegNumber: optionalText,
  bocwRegNumber: optionalText,
  // Optional: an empty field means "use the API's configured default", which is
  // the only place these statutory values are defined.
  payrollLockDay: optionalNumber(z.coerce.number().int().min(1).max(31)),
  pfEmployerRate: optionalNumber(rate),
  esicEmployerRate: optionalNumber(rate),
  gratuityRate: optionalNumber(rate),
  bonusRate: optionalNumber(rate),
});

type FormValues = z.input<typeof schema>;

const TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'registration', label: 'Registration' },
  { id: 'address', label: 'Address' },
  { id: 'statutory', label: 'Statutory' },
  { id: 'payroll', label: 'Payroll Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Which tab each field lives on, so a rejection can send the user straight to it. */
const FIELD_TAB: Record<string, TabId> = {
  name: 'basic',
  shortCode: 'basic',
  status: 'basic',
  logoUrl: 'basic',
  gstin: 'registration',
  pan: 'registration',
  cin: 'registration',
  tan: 'registration',
  address: 'address',
  city: 'address',
  state: 'address',
  pinCode: 'address',
  pfEstablishmentCode: 'statutory',
  esicCode: 'statutory',
  professionalTaxRegNumber: 'statutory',
  bocwRegNumber: 'statutory',
  payrollLockDay: 'payroll',
  pfEmployerRate: 'payroll',
  esicEmployerRate: 'payroll',
  gratuityRate: 'payroll',
  bonusRate: 'payroll',
};

/**
 * Add/Edit company across five tabs.
 *
 * One `react-hook-form` instance spans all five (research.md §5) — the tabs are
 * purely presentational. That is what lets a rejection on the Registration tab
 * leave everything typed on the other four untouched (spec FR-022): nothing is ever
 * unmounted, so nothing is ever lost.
 */
export default function CompanyModal({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>('basic');
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? '',
      shortCode: company?.shortCode ?? '',
      status: company?.status ?? 'active',
      logoUrl: company?.logoUrl ?? '',
      gstin: company?.gstin ?? '',
      pan: company?.pan ?? '',
      cin: company?.cin ?? '',
      tan: company?.tan ?? '',
      address: company?.address ?? '',
      city: company?.city ?? '',
      state: company?.state ?? '',
      pinCode: company?.pinCode ?? '',
      pfEstablishmentCode: company?.pfEstablishmentCode ?? '',
      esicCode: company?.esicCode ?? '',
      professionalTaxRegNumber: company?.professionalTaxRegNumber ?? '',
      bocwRegNumber: company?.bocwRegNumber ?? '',
      // Left blank when creating: `buildcore-api` owns these defaults and exposes
      // them as env-overridable config (SETTINGS_DEFAULT_*), so restating the
      // numbers here would both violate Principle III's no-magic-numbers rule and
      // go stale the moment a statutory rate changes server-side. The API fills
      // whatever is omitted, and the saved values come back on the response.
      payrollLockDay: company?.payrollLockDay ?? '',
      pfEmployerRate: company?.pfEmployerRate ?? '',
      esicEmployerRate: company?.esicEmployerRate ?? '',
      gratuityRate: company?.gratuityRate ?? '',
      bonusRate: company?.bonusRate ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      // Empty optional strings become null rather than "" so the API stores an
      // absent value, not a blank one.
      const NUMERIC = new Set([
        'payrollLockDay',
        'pfEmployerRate',
        'esicEmployerRate',
        'gratuityRate',
        'bonusRate',
      ]);
      // Empty text fields clear a value (null); an empty numeric field is omitted
      // entirely, so the API applies its own default rather than being told 0.
      const payload = Object.fromEntries(
        Object.entries(values)
          .filter(([key, value]) => !(NUMERIC.has(key) && value === ''))
          .map(([key, value]) => [key, value === '' ? null : value]),
      );
      return company
        ? updateCompany(company.id, payload)
        : createCompany(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onClose();
    },
    onError: (error: unknown) => {
      if (!(error instanceof ApiError)) {
        setServerError(MESSAGES.saveFailed);
        return;
      }
      // A duplicate short code is a field-level problem, so report it on the field
      // and jump to its tab rather than showing a banner the user has to hunt from.
      if (error.status === 409) {
        setError('shortCode', { message: error.message });
        setTab('basic');
        return;
      }
      if (error.status === 400) {
        const field = Object.keys(FIELD_TAB).find((name) =>
          error.message.toLowerCase().includes(name.toLowerCase()),
        );
        if (field) {
          setError(field as keyof FormValues, { message: error.message });
          setTab(FIELD_TAB[field]);
          return;
        }
      }
      setServerError(error.message || MESSAGES.saveFailed);
    },
  });

  // A validation failure on a hidden tab would otherwise look like a dead Save
  // button — switch to the first tab that has one.
  const onInvalid = (formErrors: Record<string, unknown>) => {
    const firstField = Object.keys(formErrors)[0];
    if (firstField && FIELD_TAB[firstField]) setTab(FIELD_TAB[firstField]);
  };

  const err = (field: keyof FormValues) => errors[field]?.message as string | undefined;

  return (
    <Modal
      wide
      title={company ? `Edit ${company.name}` : 'Add company'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="company-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1 border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        id="company-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values), onInvalid)}
        className="space-y-4"
      >
        <FormError message={serverError} />

        {/* Every tab stays mounted; only its visibility changes, so switching tabs
            never discards what was typed on another. */}
        <div className={tab === 'basic' ? 'space-y-4' : 'hidden'}>
          <TextField id="name" label="Company name" error={err('name')} {...register('name')} />
          <TextField
            id="shortCode"
            label="Short code"
            hint="Used as the prefix for employee codes, e.g. DC-0001."
            error={err('shortCode')}
            {...register('shortCode')}
          />
          <SelectField id="status" label="Status" error={err('status')} {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
          <TextField id="logoUrl" label="Logo URL" error={err('logoUrl')} {...register('logoUrl')} />
        </div>

        <div className={tab === 'registration' ? 'space-y-4' : 'hidden'}>
          <TextField id="gstin" label="GSTIN" hint="15 characters, e.g. 27AAPFU0939F1ZV" error={err('gstin')} {...register('gstin')} />
          <TextField id="pan" label="PAN" hint="10 characters, e.g. AAPFU0939F" error={err('pan')} {...register('pan')} />
          <TextField id="cin" label="CIN" error={err('cin')} {...register('cin')} />
          <TextField id="tan" label="TAN" error={err('tan')} {...register('tan')} />
        </div>

        <div className={tab === 'address' ? 'space-y-4' : 'hidden'}>
          <TextField id="address" label="Address" error={err('address')} {...register('address')} />
          <TextField id="city" label="City" error={err('city')} {...register('city')} />
          <TextField id="state" label="State" error={err('state')} {...register('state')} />
          <TextField id="pinCode" label="PIN code" error={err('pinCode')} {...register('pinCode')} />
        </div>

        <div className={tab === 'statutory' ? 'space-y-4' : 'hidden'}>
          <TextField id="pfEstablishmentCode" label="PF establishment code" error={err('pfEstablishmentCode')} {...register('pfEstablishmentCode')} />
          <TextField id="esicCode" label="ESIC code" error={err('esicCode')} {...register('esicCode')} />
          <TextField id="professionalTaxRegNumber" label="Professional tax registration number" error={err('professionalTaxRegNumber')} {...register('professionalTaxRegNumber')} />
          <TextField id="bocwRegNumber" label="BOCW registration number" error={err('bocwRegNumber')} {...register('bocwRegNumber')} />
        </div>

        <div className={tab === 'payroll' ? 'space-y-4' : 'hidden'}>
          <TextField id="payrollLockDay" label="Payroll lock day" type="number" min={1} max={31} placeholder="Uses the configured default" hint="Day of month after which attendance edits lock." error={err('payrollLockDay')} {...register('payrollLockDay')} />
          <TextField id="pfEmployerRate" label="PF employer rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('pfEmployerRate')} {...register('pfEmployerRate')} />
          <TextField id="esicEmployerRate" label="ESIC employer rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('esicEmployerRate')} {...register('esicEmployerRate')} />
          <TextField id="gratuityRate" label="Gratuity rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('gratuityRate')} {...register('gratuityRate')} />
          <TextField id="bonusRate" label="Bonus rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('bonusRate')} {...register('bonusRate')} />
        </div>
      </form>
    </Modal>
  );
}
