'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import {
  createEmployee,
  listSites,
  updateEmployee,
  type Employee,
  type EmployeeInput,
} from '@/app/lib/api/hr-payroll';
import {
  listDepartments,
  listDesignations,
  listShifts,
} from '@/app/lib/api/settings';
import {
  CALCULATION_MODES,
  EMPLOYMENT_TYPES,
  GENDERS,
  HR_MESSAGES,
  MARITAL_STATUSES,
  ROUTES,
  hrLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import DocumentsTab from '@/app/ui/hr/documents-tab';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

const TABS = [
  { id: 'identity', label: 'Identity' },
  { id: 'employment', label: 'Employment' },
  { id: 'statutory', label: 'Statutory' },
  { id: 'pay', label: 'Pay & Bank' },
  { id: 'contact', label: 'Contact' },
  { id: 'documents', label: 'Documents' },
  { id: 'letters', label: 'Letters' },
  { id: 'onboarding', label: 'Onboarding' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Empty string → undefined, so an untouched optional field is omitted, not sent blank. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

/**
 * One schema across all eight tabs, because it is one form and one submission.
 *
 * The cross-field statutory rules live in `superRefine` rather than on the
 * individual fields: "PF applicable requires a UAN" is a fact about the pair, and
 * expressing it on `uan` alone would leave the error attached to a field the user
 * may never have visited. `buildcore-api` re-checks the same rule and rejects the
 * request regardless — this exists so the user finds out before submitting, not
 * instead of the server.
 */
const employeeFormSchema = z
  .object({
    // Identity
    firstName: optionalText,
    lastName: optionalText,
    title: optionalText,
    dob: optionalText,
    gender: optionalText,
    maritalStatus: optionalText,

    // Employment
    siteId: z.string().min(1, 'Site is required.'),
    shiftId: z.string().min(1, 'Shift is required.'),
    departmentId: optionalText,
    designationId: optionalText,
    employmentType: optionalText,
    dateOfJoining: optionalText,
    probationEndDate: optionalText,
    confirmationDate: optionalText,
    musterCategory: optionalText,
    hoursPerDay: optionalNumber,
    dailyRate: optionalNumber,
    calculationMode: optionalText,
    workmanId: optionalText,
    isActive: z.boolean().optional(),

    // Statutory
    pfApplicable: z.boolean().optional(),
    pfUpperLimit: z.boolean().optional(),
    esicApplicable: z.boolean().optional(),
    esicUpperLimit: z.boolean().optional(),
    uan: optionalText,
    pfNumber: optionalText,
    esicNumber: optionalText,
    aadhaar: optionalText,
    pan: optionalText,

    // Pay & bank
    basic: optionalNumber,
    hra: optionalNumber,
    conveyanceAllowance: optionalNumber,
    siteAllowance: optionalNumber,
    specialAllowance: optionalNumber,
    paymentMode: optionalText,
    bankName: optionalText,
    bankBranch: optionalText,
    bankAccountNumber: optionalText,
    ifscCode: optionalText,

    // Contact
    mobile: optionalText,
    alternateMobile: optionalText,
    email: optionalText,
    presentAddress: optionalText,
    presentCity: optionalText,
    presentState: optionalText,
    presentPinCode: optionalText,
    permanentAddress: optionalText,
    permanentCity: optionalText,
    permanentState: optionalText,
    permanentPinCode: optionalText,
    emergencyContactName: optionalText,
    emergencyContactRelation: optionalText,
    emergencyContactPhone: optionalText,

    // Letters
    offerLetterIssued: z.boolean().optional(),
    offerLetterIssuedDate: optionalText,
    appointmentLetterIssued: z.boolean().optional(),
    appointmentLetterIssuedDate: optionalText,
    ndaSigned: z.boolean().optional(),
    ndaSignedDate: optionalText,

    // Onboarding
    idCardIssued: z.boolean().optional(),
    uniformProvided: z.boolean().optional(),
    safetyInductionCompleted: z.boolean().optional(),
    toolsIssued: z.boolean().optional(),
    bankVerificationDone: z.boolean().optional(),
    biometricEnrolled: z.boolean().optional(),
    siteAccessGranted: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.pfApplicable) {
      if (!values.uan) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['uan'],
          message: 'A UAN is required when PF applies.',
        });
      }
      if (!values.pfNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pfNumber'],
          message: 'A PF number is required when PF applies.',
        });
      }
    }
    if (values.esicApplicable && !values.esicNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['esicNumber'],
        message: 'An ESIC number is required when ESIC applies.',
      });
    }
    // A daily-wage employee is paid per day, so the rate is what makes their
    // payroll line computable at all — an omission here surfaces as a zero net pay
    // several screens later, which is far more expensive to trace back.
    if (values.employmentType === 'daily_wage' && values.dailyRate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dailyRate'],
        message: 'A daily-wage employee needs a daily rate.',
      });
    }
  });

type EmployeeFormValues = z.input<typeof employeeFormSchema>;
type EmployeeFormOutput = z.output<typeof employeeFormSchema>;

/** Only the date part — `<input type="date">` refuses a full ISO timestamp. */
const dateValue = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : '';

function defaultsFrom(employee?: Employee): EmployeeFormValues {
  if (!employee) {
    return {
      siteId: '',
      shiftId: '',
      isActive: true,
      employmentType: 'full_time',
      calculationMode: 'monthly',
    };
  }
  return {
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    title: employee.title ?? '',
    dob: dateValue(employee.dob),
    gender: employee.gender ?? '',
    maritalStatus: employee.maritalStatus ?? '',

    siteId: employee.siteId,
    shiftId: employee.shiftId,
    departmentId: employee.departmentId ?? '',
    designationId: employee.designationId ?? '',
    employmentType: employee.employmentType ?? 'full_time',
    dateOfJoining: dateValue(employee.dateOfJoining),
    probationEndDate: dateValue(employee.probationEndDate),
    confirmationDate: dateValue(employee.confirmationDate),
    musterCategory: employee.musterCategory ?? '',
    hoursPerDay: employee.hoursPerDay ?? undefined,
    dailyRate: employee.dailyRate ?? undefined,
    calculationMode: employee.calculationMode ?? 'monthly',
    workmanId: employee.workmanId ?? '',
    isActive: employee.isActive,

    pfApplicable: employee.pfApplicable,
    pfUpperLimit: employee.pfUpperLimit,
    esicApplicable: employee.esicApplicable,
    esicUpperLimit: employee.esicUpperLimit,
    uan: employee.uan ?? '',
    pfNumber: employee.pfNumber ?? '',
    esicNumber: employee.esicNumber ?? '',
    // Deliberately NOT prefilled: the API only ever returns these masked, and
    // seeding the input with "XXXXXXXX1234" would write the mask back as the value
    // on the next save. Blank means "leave unchanged".
    aadhaar: '',
    pan: '',

    basic: employee.basic ?? undefined,
    hra: employee.hra ?? undefined,
    conveyanceAllowance: employee.conveyanceAllowance ?? undefined,
    siteAllowance: employee.siteAllowance ?? undefined,
    specialAllowance: employee.specialAllowance ?? undefined,
    paymentMode: employee.paymentMode ?? '',
    bankName: employee.bankName ?? '',
    bankBranch: employee.bankBranch ?? '',
    bankAccountNumber: '',
    ifscCode: employee.ifscCode ?? '',

    mobile: employee.mobile ?? '',
    alternateMobile: employee.alternateMobile ?? '',
    email: employee.email ?? '',
    presentAddress: employee.presentAddress ?? '',
    presentCity: employee.presentCity ?? '',
    presentState: employee.presentState ?? '',
    presentPinCode: employee.presentPinCode ?? '',
    permanentAddress: employee.permanentAddress ?? '',
    permanentCity: employee.permanentCity ?? '',
    permanentState: employee.permanentState ?? '',
    permanentPinCode: employee.permanentPinCode ?? '',
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactRelation: employee.emergencyContactRelation ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',

    offerLetterIssued: employee.offerLetterIssued,
    offerLetterIssuedDate: dateValue(employee.offerLetterIssuedDate),
    appointmentLetterIssued: employee.appointmentLetterIssued,
    appointmentLetterIssuedDate: dateValue(employee.appointmentLetterIssuedDate),
    ndaSigned: employee.ndaSigned,
    ndaSignedDate: dateValue(employee.ndaSignedDate),

    idCardIssued: employee.idCardIssued,
    uniformProvided: employee.uniformProvided,
    safetyInductionCompleted: employee.safetyInductionCompleted,
    toolsIssued: employee.toolsIssued,
    bankVerificationDone: employee.bankVerificationDone,
    biometricEnrolled: employee.biometricEnrolled,
    siteAccessGranted: employee.siteAccessGranted,
  };
}

export default function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('identity');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema) as Resolver<EmployeeFormValues>,
    defaultValues: defaultsFrom(employee),
  });

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  const { data: designations } = useQuery({
    queryKey: ['designations'],
    queryFn: () => listDesignations(),
  });
  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => listShifts(),
  });

  // `useWatch` rather than `watch()`: the latter returns a fresh function each
  // render, which the React Compiler refuses to memoize around.
  const employmentType = useWatch({ control, name: 'employmentType' });
  const pfApplicable = useWatch({ control, name: 'pfApplicable' });
  const esicApplicable = useWatch({ control, name: 'esicApplicable' });

  /**
   * Warns before a reload or a tab close discards unsaved work (spec FR-018).
   *
   * Only covers full-document navigations — `beforeunload` never fires on a
   * client-side route change, so the Cancel button asks separately below.
   */
  useEffect(() => {
    if (!isDirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormOutput) => {
      const input = values as unknown as EmployeeInput;
      return employee
        ? updateEmployee(employee.id, input)
        : createEmployee(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      router.push(ROUTES.hrEmployee(saved.id));
    },
    onError: (error: Error) => setServerError(error.message),
  });

  function cancel() {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    router.push(ROUTES.hrEmployees);
  }

  const errorFor = (field: keyof EmployeeFormValues) =>
    errors[field]?.message as string | undefined;

  /**
   * Which tabs are currently showing a validation error.
   *
   * Without this, submitting from the Onboarding tab with a bad Statutory field
   * scrolls to nothing and appears to do nothing at all — the error is real but on
   * a panel that is not rendered.
   */
  const TAB_FIELDS: Record<TabId, (keyof EmployeeFormValues)[]> = {
    identity: ['firstName', 'lastName', 'dob'],
    employment: ['siteId', 'shiftId', 'dailyRate', 'hoursPerDay'],
    statutory: ['uan', 'pfNumber', 'esicNumber', 'aadhaar', 'pan'],
    pay: ['basic', 'hra', 'ifscCode', 'bankAccountNumber'],
    contact: ['mobile', 'email'],
    documents: [],
    letters: [],
    onboarding: [],
  };
  const tabsWithErrors = TABS.filter((candidate) =>
    TAB_FIELDS[candidate.id].some((field) => errors[field]),
  );

  return (
    <form
      onSubmit={handleSubmit((values) =>
        mutation.mutateAsync(values as EmployeeFormOutput),
      )}
      className="flex flex-col gap-2"
      noValidate
    >
      <TabStrip tabs={TABS} active={tab} onChange={setTab} idPrefix="employee" />

      {tabsWithErrors.length > 0 && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          Fix the errors on:{' '}
          {tabsWithErrors.map((candidate, index) => (
            <span key={candidate.id}>
              {index > 0 && ', '}
              <button
                type="button"
                onClick={() => setTab(candidate.id)}
                className="font-medium underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                {candidate.label}
              </button>
            </span>
          ))}
        </p>
      )}

      <TabPanel id="identity" idPrefix="employee" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField id="title" label="Title" {...register('title')} />
          <TextField
            id="firstName"
            label="First name"
            error={errorFor('firstName')}
            {...register('firstName')}
          />
          <TextField
            id="lastName"
            label="Last name"
            error={errorFor('lastName')}
            {...register('lastName')}
          />
          <TextField id="dob" label="Date of birth" type="date" {...register('dob')} />
          <SelectField id="gender" label="Gender" {...register('gender')}>
            <option value="">Not stated</option>
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="maritalStatus"
            label="Marital status"
            {...register('maritalStatus')}
          >
            <option value="">Not stated</option>
            {MARITAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
        </div>
        {employee && (
          <p className="mt-4 text-sm text-gray-600">
            Employee code <strong>{employee.employeeCode}</strong> is allocated from
            the company series and cannot be edited here.
          </p>
        )}
      </TabPanel>

      <TabPanel id="employment" idPrefix="employee" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            id="siteId"
            label="Site"
            error={errorFor('siteId')}
            {...register('siteId')}
          >
            <option value="">Select a site</option>
            {sites?.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="shiftId"
            label="Shift"
            error={errorFor('shiftId')}
            {...register('shiftId')}
          >
            <option value="">Select a shift</option>
            {shifts?.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
              </option>
            ))}
          </SelectField>
          <SelectField id="departmentId" label="Department" {...register('departmentId')}>
            <option value="">Unassigned</option>
            {departments?.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="designationId"
            label="Designation"
            {...register('designationId')}
          >
            <option value="">Unassigned</option>
            {designations?.map((designation) => (
              <option key={designation.id} value={designation.id}>
                {designation.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="employmentType"
            label="Employment type"
            {...register('employmentType')}
          >
            {EMPLOYMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="calculationMode"
            label="Calculation mode"
            {...register('calculationMode')}
          >
            {CALCULATION_MODES.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
          <TextField
            id="dateOfJoining"
            label="Date of joining"
            type="date"
            {...register('dateOfJoining')}
          />
          <TextField
            id="probationEndDate"
            label="Probation ends"
            type="date"
            {...register('probationEndDate')}
          />
          <TextField
            id="confirmationDate"
            label="Confirmed on"
            type="date"
            {...register('confirmationDate')}
          />
          <TextField
            id="hoursPerDay"
            label="Hours per day"
            type="number"
            step="0.25"
            hint="Overtime is computed against this."
            {...register('hoursPerDay')}
          />
          {/* Shown only for the type that needs it, per spec FR-001 scenario 3. */}
          {employmentType === 'daily_wage' && (
            <TextField
              id="dailyRate"
              label="Daily rate"
              type="number"
              step="0.01"
              error={errorFor('dailyRate')}
              {...register('dailyRate')}
            />
          )}
          {employmentType === 'contract' && (
            <TextField
              id="workmanId"
              label="Workman ID"
              {...register('workmanId')}
            />
          )}
          <TextField
            id="musterCategory"
            label="Muster category"
            {...register('musterCategory')}
          />
        </div>
        <div className="mt-4">
          <CheckboxField id="isActive" label="Active" {...register('isActive')} />
        </div>
      </TabPanel>

      <TabPanel id="statutory" idPrefix="employee" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
            <CheckboxField
              id="pfApplicable"
              label="PF applicable"
              {...register('pfApplicable')}
            />
            <CheckboxField
              id="pfUpperLimit"
              label="Cap PF at the statutory wage ceiling"
              description="Uncapped, PF is computed on the full basic."
              {...register('pfUpperLimit')}
            />
            <CheckboxField
              id="esicApplicable"
              label="ESIC applicable"
              {...register('esicApplicable')}
            />
            <CheckboxField
              id="esicUpperLimit"
              label="Apply the ESIC wage threshold"
              description="ESIC is a threshold, not a cap — above it, no contribution is due at all."
              {...register('esicUpperLimit')}
            />
          </div>
          {/* Required only when the corresponding contribution applies (FR-001 s4). */}
          <TextField
            id="uan"
            label={pfApplicable ? 'UAN (required)' : 'UAN'}
            error={errorFor('uan')}
            {...register('uan')}
          />
          <TextField
            id="pfNumber"
            label={pfApplicable ? 'PF number (required)' : 'PF number'}
            error={errorFor('pfNumber')}
            {...register('pfNumber')}
          />
          <TextField
            id="esicNumber"
            label={esicApplicable ? 'ESIC number (required)' : 'ESIC number'}
            error={errorFor('esicNumber')}
            {...register('esicNumber')}
          />
          <TextField
            id="aadhaar"
            label="Aadhaar"
            hint={
              employee
                ? 'Stored encrypted. Leave blank to keep the existing value.'
                : 'Stored encrypted; only ever shown masked afterwards.'
            }
            error={errorFor('aadhaar')}
            {...register('aadhaar')}
          />
          <TextField
            id="pan"
            label="PAN"
            hint={
              employee
                ? 'Leave blank to keep the existing value.'
                : 'Without a PAN, TDS is deducted at the higher no-PAN rate.'
            }
            error={errorFor('pan')}
            {...register('pan')}
          />
        </div>
        <p className="mt-4 text-sm text-gray-600">{HR_MESSAGES.statutoryNeedsNumbers}</p>
      </TabPanel>

      <TabPanel id="pay" idPrefix="employee" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField id="basic" label="Basic" type="number" step="0.01" {...register('basic')} />
          <TextField id="hra" label="HRA" type="number" step="0.01" {...register('hra')} />
          <TextField
            id="conveyanceAllowance"
            label="Conveyance allowance"
            type="number"
            step="0.01"
            {...register('conveyanceAllowance')}
          />
          <TextField
            id="siteAllowance"
            label="Site allowance"
            type="number"
            step="0.01"
            {...register('siteAllowance')}
          />
          <TextField
            id="specialAllowance"
            label="Special allowance"
            type="number"
            step="0.01"
            {...register('specialAllowance')}
          />
          <TextField id="paymentMode" label="Payment mode" {...register('paymentMode')} />
          <TextField id="bankName" label="Bank" {...register('bankName')} />
          <TextField id="bankBranch" label="Branch" {...register('bankBranch')} />
          <TextField
            id="bankAccountNumber"
            label="Account number"
            hint={
              employee
                ? 'Stored encrypted. Leave blank to keep the existing value.'
                : 'Stored encrypted; only ever shown masked afterwards.'
            }
            {...register('bankAccountNumber')}
          />
          <TextField id="ifscCode" label="IFSC" {...register('ifscCode')} />
        </div>
      </TabPanel>

      <TabPanel id="contact" idPrefix="employee" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField id="mobile" label="Mobile" {...register('mobile')} />
          <TextField
            id="alternateMobile"
            label="Alternate mobile"
            {...register('alternateMobile')}
          />
          <TextField id="email" label="Email" type="email" {...register('email')} />
        </div>
        <h3 className="mt-6 text-sm font-medium text-gray-900">Present address</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="presentAddress"
            label="Address"
            className="sm:col-span-2"
            {...register('presentAddress')}
          />
          <TextField id="presentCity" label="City" {...register('presentCity')} />
          <TextField id="presentState" label="State" {...register('presentState')} />
          <TextField id="presentPinCode" label="PIN code" {...register('presentPinCode')} />
        </div>
        <h3 className="mt-6 text-sm font-medium text-gray-900">Permanent address</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="permanentAddress"
            label="Address"
            {...register('permanentAddress')}
          />
          <TextField id="permanentCity" label="City" {...register('permanentCity')} />
          <TextField id="permanentState" label="State" {...register('permanentState')} />
          <TextField
            id="permanentPinCode"
            label="PIN code"
            {...register('permanentPinCode')}
          />
        </div>
        <h3 className="mt-6 text-sm font-medium text-gray-900">Emergency contact</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            id="emergencyContactName"
            label="Name"
            {...register('emergencyContactName')}
          />
          <TextField
            id="emergencyContactRelation"
            label="Relationship"
            {...register('emergencyContactRelation')}
          />
          <TextField
            id="emergencyContactPhone"
            label="Phone"
            {...register('emergencyContactPhone')}
          />
        </div>
      </TabPanel>

      <TabPanel id="documents" idPrefix="employee" active={tab}>
        {employee ? (
          <DocumentsTab employeeId={employee.id} />
        ) : (
          <p className="text-sm text-gray-600">
            Documents can be uploaded once the employee has been saved — each upload
            is filed against their record.
          </p>
        )}
      </TabPanel>

      <TabPanel id="letters" idPrefix="employee" active={tab}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckboxField
              id="offerLetterIssued"
              label="Offer letter issued"
              {...register('offerLetterIssued')}
            />
            <TextField
              id="offerLetterIssuedDate"
              label="Issued on"
              type="date"
              {...register('offerLetterIssuedDate')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckboxField
              id="appointmentLetterIssued"
              label="Appointment letter issued"
              {...register('appointmentLetterIssued')}
            />
            <TextField
              id="appointmentLetterIssuedDate"
              label="Issued on"
              type="date"
              {...register('appointmentLetterIssuedDate')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckboxField id="ndaSigned" label="NDA signed" {...register('ndaSigned')} />
            <TextField
              id="ndaSignedDate"
              label="Signed on"
              type="date"
              {...register('ndaSignedDate')}
            />
          </div>
        </div>
      </TabPanel>

      <TabPanel id="onboarding" idPrefix="employee" active={tab}>
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxField id="idCardIssued" label="ID card issued" {...register('idCardIssued')} />
          <CheckboxField
            id="uniformProvided"
            label="Uniform provided"
            {...register('uniformProvided')}
          />
          <CheckboxField
            id="safetyInductionCompleted"
            label="Safety induction completed"
            {...register('safetyInductionCompleted')}
          />
          <CheckboxField id="toolsIssued" label="Tools issued" {...register('toolsIssued')} />
          <CheckboxField
            id="bankVerificationDone"
            label="Bank details verified"
            {...register('bankVerificationDone')}
          />
          <CheckboxField
            id="biometricEnrolled"
            label="Biometrics enrolled"
            {...register('biometricEnrolled')}
          />
          <CheckboxField
            id="siteAccessGranted"
            label="Site access granted"
            {...register('siteAccessGranted')}
          />
        </div>
      </TabPanel>

      <FormError message={serverError} />

      {/* One submit for the whole form — the tabs are panels, not steps. */}
      <div className="sticky bottom-0 mt-2 flex justify-end gap-2 border-t border-gray-200 bg-white py-3">
        <SecondaryButton type="button" onClick={cancel}>
          Cancel
        </SecondaryButton>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? 'Saving…' : employee ? 'Save changes' : 'Create employee'}
        </Button>
      </div>
    </form>
  );
}
