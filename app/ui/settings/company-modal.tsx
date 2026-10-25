'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import {
  Company,
  createCompany,
  updateCompany,
  uploadCompanyLogo,
} from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import { toast } from '@/app/ui/toast';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { focusFirstInvalid } from '@/app/lib/form-focus';
import CompanyBranchesPanel from '@/app/ui/settings/company-branches-panel';

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
  phone: optionalText,
  email: optionalText.refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Not a valid email'),
  website: optionalText,
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
  /**
   * Text, never a number (021 FR-008a). `z.coerce.number()` on `09310400000819` yields
   * `9310400000819` — the leading zero gone, and the transfer rejected at the bank.
   */
  payrollDebitAccountNumber: optionalText,
});

type FormValues = z.input<typeof schema>;

const TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'registration', label: 'Registration' },
  // The head office's (041): every other GST registration is on the Branches tab.
  { id: 'address', label: 'Head Office' },
  { id: 'statutory', label: 'Statutory' },
  { id: 'payroll', label: 'Payroll Settings' },
  { id: 'branches', label: 'Branches' },
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
  phone: 'address',
  email: 'address',
  website: 'address',
  pfEstablishmentCode: 'statutory',
  esicCode: 'statutory',
  professionalTaxRegNumber: 'statutory',
  bocwRegNumber: 'statutory',
  payrollLockDay: 'payroll',
  pfEmployerRate: 'payroll',
  esicEmployerRate: 'payroll',
  gratuityRate: 'payroll',
  bonusRate: 'payroll',
  payrollDebitAccountNumber: 'payroll',
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
  // A logo chosen while creating, sent once the company exists (036 C7).
  const [pendingLogo, setPendingLogo] = useState<PreparedFile | null>(null);
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  // 036 C9: a company's status and short code are a group administrator's to change; the API
  // refuses anyone else (GROUP_ACCESS_REQUIRED). Shown, not offered, for a company administrator.
  const isGroupAdmin = me?.permissions.includes('CROSS_COMPANY_ACCESS') ?? false;
  const lockedForCompanyAdmin = Boolean(company) && !isGroupAdmin;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? '',
      shortCode: company?.shortCode ?? '',
      status: company?.status ?? 'active',
      // Round-trips untouched; the field is no longer offered — see the note above.
      logoUrl: company?.logoUrl ?? '',
      gstin: company?.gstin ?? '',
      pan: company?.pan ?? '',
      cin: company?.cin ?? '',
      tan: company?.tan ?? '',
      address: company?.address ?? '',
      city: company?.city ?? '',
      state: company?.state ?? '',
      pinCode: company?.pinCode ?? '',
      phone: company?.phone ?? '',
      email: company?.email ?? '',
      website: company?.website ?? '',
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
      payrollDebitAccountNumber: company?.payrollDebitAccountNumber ?? '',
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
      if (lockedForCompanyAdmin) {
        // Not sent at all: unchanged values would pass, but a stale form must not trip the rule.
        delete payload.status;
        delete payload.shortCode;
      }
      return company
        ? updateCompany(company.id, payload)
        : createCompany(payload);
    },
    onSuccess: async (saved) => {
      if (!company && pendingLogo) {
        // The company exists now, so its logo can be stored (036 C7). A failed logo does not undo
        // the company; it says so, and the logo can be added from Edit.
        try {
          await uploadCompanyLogo(saved.id, pendingLogo.file);
        } catch (error) {
          toast.error(
            errorMessage(error, 'The company was saved, but its logo could not be. Add it from Edit.'),
          );
        }
      }
      // `['companies']` also covers `['companies', 'selectable']`, which the sidebar logo and the
      // company switcher read (036 C7).
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(company ? `${saved.name} saved.` : `${saved.name} added.`);
      onClose();
    },
    onError: (error: unknown) => {
      if (!(error instanceof ApiError)) {
        setServerError(errorMessage(error, MESSAGES.saveFailed));
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
    // …and put the keyboard on the field once its tab is showing (036 A22).
    focusFirstInvalid(document.getElementById('company-form'));
  };

  const err = (field: keyof FormValues) => errors[field]?.message as string | undefined;

  return (
    <Modal
      wide
      title={company ? `Edit ${company.name}` : 'Add company'}
      onClose={onClose}
      isDirty={isDirty || pendingLogo !== null}
      pending={mutation.isPending}
      footer={
        // The Branches tab saves each branch on its own; the company form's Save there would read
        // as saving the branches, which it does not.
        tab === 'branches' ? (
          <SecondaryButton type="button" onClick={onClose}>
            Done
          </SecondaryButton>
        ) : (
        <>
          <SecondaryButton
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </SecondaryButton>
          {/* `isPending`, not react-hook-form's `isSubmitting`: the submit handler calls `mutate`
              without awaiting it, so `isSubmitting` was false again before the request left and a
              second click sent a second create (036 C6). */}
          <Button
            type="submit"
            form="company-form"
            loading={mutation.isPending}
          >
            Save
          </Button>
        </>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-1 border-b" role="tablist">
        {/* Branches exist once the company does: they are saved on their own, not with this form. */}
        {TABS.filter((t) => t.id !== 'branches' || company).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
              tab === t.id
                ? 'border-brand-500 text-brand-600'
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
          <TextField id="name" label="Company name" aria-required="true" error={err('name')} {...register('name')} />
          <TextField
            id="shortCode"
            label="Short code"
            aria-required="true"
            readOnly={lockedForCompanyAdmin}
            hint={
              lockedForCompanyAdmin
                ? 'Only a group administrator can change the short code.'
                : 'Used as the prefix for employee codes, e.g. DC-0001.'
            }
            error={err('shortCode')}
            {...register('shortCode')}
          />
          {lockedForCompanyAdmin ? (
            // Not a disabled select: react-hook-form reads a disabled field as undefined, and the
            // schema would then refuse the form over a field the user cannot touch. Unregistered,
            // the value stays the loaded one (and the save does not send it).
            <TextField
              id="status"
              label="Status"
              readOnly
              value={company?.status === 'inactive' ? 'Inactive' : 'Active'}
              hint="Only a group administrator can activate or deactivate a company."
            />
          ) : (
            <SelectField id="status" label="Status" error={err('status')} {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectField>
          )}
          {company ? (
            <LogoUpload companyId={company.id} />
          ) : (
            <FileUpload
              label="Logo"
              accept={LOGO_ACCEPT}
              maxBytes={LOGO_MAX_BYTES}
              compress={false}
              hint="PNG or JPEG, up to 2 MB. Saved once the company is added."
              onSelect={setPendingLogo}
            />
          )}
          {/* "Logo URL" is gone (2026-10-12). It was written here and read by nothing
              since 002, and a company's logo is now an uploaded image — see
              `Company.logoRef` and `PUT /settings/companies/:id/logo`. Two controls for
              one thing, one of which does nothing, is worse than one.
              Still registered below and still submitted unchanged, so whatever rows
              already hold is preserved rather than blanked by a save. */}
        </div>

        <div className={tab === 'registration' ? 'space-y-4' : 'hidden'}>
          <TextField id="gstin" label="Head office GSTIN" hint="15 characters, e.g. 27AAPFU0939F1ZV. Other GSTINs are added as branches." error={err('gstin')} {...register('gstin')} />
          <TextField id="pan" label="PAN" hint="10 characters, e.g. AAPFU0939F" error={err('pan')} {...register('pan')} />
          <TextField id="cin" label="CIN" error={err('cin')} {...register('cin')} />
          <TextField id="tan" label="TAN" error={err('tan')} {...register('tan')} />
        </div>

        <div className={tab === 'address' ? 'space-y-4' : 'hidden'}>
          <TextField id="address" label="Address" error={err('address')} {...register('address')} />
          <TextField id="city" label="City" error={err('city')} {...register('city')} />
          <TextField id="state" label="State" error={err('state')} {...register('state')} />
          <TextField id="pinCode" label="PIN code" error={err('pinCode')} {...register('pinCode')} />
          <TextField id="phone" label="Phone" hint="Printed at the head of work orders and purchase orders" error={err('phone')} {...register('phone')} />
          <TextField id="email" label="Email" error={err('email')} {...register('email')} />
          <TextField id="website" label="Website" error={err('website')} {...register('website')} />
        </div>

        <div className={tab === 'statutory' ? 'space-y-4' : 'hidden'}>
          <TextField id="pfEstablishmentCode" label="PF establishment code" hint="The head office's; each branch can carry its own on the Branches tab" error={err('pfEstablishmentCode')} {...register('pfEstablishmentCode')} />
          <TextField id="esicCode" label="ESIC code" error={err('esicCode')} {...register('esicCode')} />
          <TextField id="professionalTaxRegNumber" label="Professional tax registration number" error={err('professionalTaxRegNumber')} {...register('professionalTaxRegNumber')} />
          <TextField id="bocwRegNumber" label="BOCW registration number" error={err('bocwRegNumber')} {...register('bocwRegNumber')} />
        </div>

        <div className={tab === 'payroll' ? 'space-y-4' : 'hidden'}>
          <TextField id="payrollDebitAccountNumber" label="Payroll debit account number" placeholder="e.g. 09310400000819" hint="The company account salary transfers are debited from. Kept as text so a leading zero survives — the bank transfer sheet cannot be generated without it." error={err('payrollDebitAccountNumber')} {...register('payrollDebitAccountNumber')} />
          <TextField id="payrollLockDay" label="Payroll lock day" type="number" min={1} max={31} placeholder="Uses the configured default" hint="Day of month after which attendance edits lock." error={err('payrollLockDay')} {...register('payrollLockDay')} />
          <TextField id="pfEmployerRate" label="PF employer rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('pfEmployerRate')} {...register('pfEmployerRate')} />
          <TextField id="esicEmployerRate" label="ESIC employer rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('esicEmployerRate')} {...register('esicEmployerRate')} />
          <TextField id="gratuityRate" label="Gratuity rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('gratuityRate')} {...register('gratuityRate')} />
          <TextField id="bonusRate" label="Bonus rate (%)" type="number" step="0.01" placeholder="Uses the configured default" error={err('bonusRate')} {...register('bonusRate')} />
        </div>
      </form>

      {company && tab === 'branches' && <CompanyBranchesPanel companyId={company.id} />}
    </Modal>
  );
}

/** Logos keep their own pixels: compressing would flatten a transparent PNG onto white. */
const LOGO_ACCEPT = 'image/png,image/jpeg';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The company's logo, uploaded as an image (2026-10-13). Shown in the sidebar and at the head of
 * every payment advice. Saved on its own, the moment a file is chosen — it is not part of the form.
 *
 * 036 C7: it refreshed `['companies', id, 'logo']`, a key nothing reads, so the sidebar kept the old
 * mark until a reload. The sidebar reads `['companies', 'selectable']` — whose `logoVersion` names
 * the image — so that is what is refreshed now. `FileUpload` adds the preview, the size check and
 * the reset after an error.
 */
function LogoUpload({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  return (
    <FileUpload
      label="Logo"
      accept={LOGO_ACCEPT}
      maxBytes={LOGO_MAX_BYTES}
      compress={false}
      hint="PNG or JPEG, up to 2 MB. Shown in the sidebar and printed on payment advices — a wide, short image reads best."
      onUpload={async (prepared) => {
        await uploadCompanyLogo(companyId, prepared.file);
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
        toast.success('Logo saved.');
      }}
    />
  );
}
