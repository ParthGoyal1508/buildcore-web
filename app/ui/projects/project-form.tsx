'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '@/app/lib/api/client';
import { listEmployees } from '@/app/lib/api/hr-payroll';
import { getDocumentRequirements } from '@/app/lib/api/project-documents';
import { useUnsavedChanges } from '@/app/lib/unsaved-changes';
import ProjectDocumentUploads, {
  unstagedMandatory,
  type StagedUploads,
} from '@/app/ui/projects/project-document-uploads';
import {
  Project,
  ProjectInput,
  createProject,
  getClients,
  updateProject,
} from '@/app/lib/api/projects';
import {
  DOCUMENT_COPY,
  MESSAGES,
  PROJECT_DIVISIONS,
  PROJECT_SITE_TYPES,
  PROJECT_STATUSES,
  ROUTES,
  projectsLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * The shape a project form must satisfy before it is worth sending (spec FR-002).
 *
 * Exported because it *is* the client-side contract for a project — anything else
 * that builds one should validate against this rather than re-deriving the rules.
 */
export const projectSchema = z
  .object({
    code: z.string().trim().max(50).optional(),
    name: z.string().trim().min(1, 'Project name is required.').max(200),
    clientId: z.string().min(1, 'Choose a client.'),
    location: z.string().trim().optional(),
    contractValue: z.coerce
      .number({ invalid_type_error: 'Contract value must be a number.' })
      .min(0, 'Contract value cannot be negative.'),
    startDate: z.string().min(1, 'Start date is required.'),
    expectedEndDate: z.string().optional(),
    status: z.enum(PROJECT_STATUSES),
    projectManagerEmployeeId: z.string().optional(),
    division: z.enum(PROJECT_DIVISIONS),
    departmentType: z.string().trim().optional(),
    projectType: z.string().trim().optional(),
    siteType: z.enum(PROJECT_SITE_TYPES),
    isHO: z.boolean(),
    siteStartDate: z.string().optional(),
    purchaseLimit: z.string().optional(),
    orderNumber: z.string().trim().optional(),
    cgstApplicable: z.boolean(),
    /**
     * The client contract's retention term, **typed as a percentage** — 5 means 5%.
     *
     * Stored as the fraction the API takes, which is the same convention the subcontract term
     * already uses: `WorkOrder.retentionPercent` is a fraction too, and the bill composer reads
     * both four lines apart in one function. Converting here keeps those two in one unit.
     *
     * Empty is not zero. A project with no term recorded is refused when a client bill is composed
     * — deliberately, because billing at zero retention makes the payable five per cent too high
     * and nothing downstream would notice.
     */
    clientRetentionPercent: z.string().optional(),
    description: z.string().trim().optional(),
    isLocked: z.boolean(),
  })
  // Cross-field, so it cannot live on either field alone. Reported on the end date
  // because that is the one the user most likely mistyped — the start date was
  // entered first and is usually the fixed one.
  .refine((v) => !v.expectedEndDate || v.expectedEndDate >= v.startDate, {
    message: 'Expected end date cannot be before the start date.',
    path: ['expectedEndDate'],
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

/** An ISO timestamp trimmed to the `yyyy-mm-dd` an `<input type="date">` accepts. */
const dateInput = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : '';

/**
 * Create or edit a project (spec US3).
 *
 * A full page rather than a modal: twenty fields in a dialog is a scroll trap, and
 * this is the one form in the module people fill in deliberately rather than in
 * passing.
 */
export default function ProjectForm({ project }: { project?: Project }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  /**
   * Files staged against each required kind, and the kinds the server last refused for.
   *
   * Both live in component state and are **never cleared on a refusal** (017 FR-023a, T073). The
   * staged references stay valid on the server, so a second submission reuses them rather than
   * asking for the files again — which a browser could not restore anyway, since a page cannot
   * re-populate a file input. A gate that emptied the form would punish the person complying
   * with it.
   */
  const [staged, setStaged] = useState<StagedUploads>({});
  const [missingTypeIds, setMissingTypeIds] = useState<string[]>([]);

  /**
   * The required set, read only when creating.
   *
   * An existing project is past the gate: FR-009 refuses *creation*, and documents are filed
   * against a project that exists through its own documents screen. Asking here on an edit would
   * render upload controls that answer a requirement already satisfied or already waived.
   */
  /**
   * No `companyId` is passed, and that is deliberate.
   *
   * The server resolves the company from the caller's session and narrows it to their selected company
   * (019 FR-004), so there is nothing for a screen to send. This was already how every screen under
   * `/dashboard/projects` behaved; as of 019 Phase 4 it is how the whole application behaves, and the
   * provider that made it unusual here no longer exists.
   */
  const { data: requirementSet } = useQuery({
    queryKey: ['projectDocumentRequirements'],
    queryFn: () => getDocumentRequirements(),
    enabled: !project,
  });

  /**
   * **Empty on an edit, and `enabled: false` is not enough to make it so.**
   *
   * `enabled` stops the *fetch*; it does not stop `useQuery` returning what is already in the cache
   * under this key. Create the project and then edit it — which is the ordinary order — and the
   * requirement set is sitting in the cache from the create page, so an edit read four required
   * kinds, found nothing staged against them (a fresh form stages nothing), disabled Save and said
   * "4 required documents are still missing". With the upload section correctly hidden on an edit,
   * the gate asked for something the screen gave no way to provide.
   *
   * Reported by the client on 6 October, triaged as not reproducing, and **that triage was wrong**:
   * it was tested by loading the edit URL directly, where the cache is empty and nothing shows. It
   * reproduces every time the two pages are visited in one session.
   *
   * Derived here rather than by widening `enabled`, because this is the one place both consumers
   * read from — the upload section and the submit gate — and the bug was precisely that those two
   * disagreed. An existing project is past FR-009's gate; its documents are filed through its own
   * documents screen.
   */
  const requirements = project ? [] : (requirementSet?.requirements ?? []);
  const outstanding = unstagedMandatory(requirements, staged);

  const { data: clients } = useQuery({
    queryKey: ['projects', 'clients', { pageSize: 200 }],
    queryFn: () => getClients({ pageSize: 200, status: 'active' }),
  });

  // The project manager picker. Active employees only — assigning a leaver is
  // never intended, and the list is long enough without them.
  const { data: employees } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 200, isActive: true }],
    queryFn: () => listEmployees({ pageSize: 200, isActive: true }),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      code: project?.code ?? '',
      name: project?.name ?? '',
      clientId: project?.clientId ?? '',
      location: project?.location ?? '',
      contractValue: project?.contractValue ?? 0,
      startDate: dateInput(project?.startDate),
      expectedEndDate: dateInput(project?.expectedEndDate),
      status: project?.status ?? 'planning',
      projectManagerEmployeeId: project?.projectManagerEmployeeId ?? '',
      division: project?.division ?? 'contract',
      departmentType: project?.departmentType ?? '',
      projectType: project?.projectType ?? '',
      siteType: project?.siteType ?? 'site',
      isHO: project?.isHO ?? false,
      siteStartDate: dateInput(project?.siteStartDate),
      purchaseLimit:
        project?.purchaseLimit != null ? String(project.purchaseLimit) : '',
      orderNumber: project?.orderNumber ?? '',
      cgstApplicable: project?.cgstApplicable ?? false,
      clientRetentionPercent:
        project?.clientRetentionFraction === null ||
        project?.clientRetentionFraction === undefined
          ? ''
          : String(Number(project.clientRetentionFraction) * 100),
      description: project?.description ?? '',
      isLocked: project?.isLocked ?? false,
    },
  });

  /**
   * Warns before a browser-level navigation loses unsaved edits (spec FR-002).
   *
   * `beforeunload` covers a reload, a closed tab and a typed URL. It does **not**
   * cover an in-app `<Link>`: the App Router has no navigation-interception API, so
   * a router-level guard would mean intercepting every anchor click by hand. The
   * explicit Cancel button below asks instead, which is the path people actually
   * take out of a form.
   */
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  /**
   * Lets a company switch warn before it discards this form (019 FR-006).
   *
   * The `beforeunload` guard above cannot cover it: switching company is a client-side state change,
   * so the browser never fires a navigation event. This registration is what makes the switcher's
   * confirmation name this screen instead of saying nothing.
   */
  useUnsavedChanges('Project form', isDirty);

  const wasLocked = project?.isLocked ?? false;
  // `useWatch` rather than `watch()`: the latter returns a fresh function on every
  // render, which makes React Compiler skip memoizing this whole component.
  const isLocked = useWatch({ control, name: 'isLocked' });

  const mutation = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      const payload: ProjectInput = {
        name: values.name,
        clientId: values.clientId,
        location: values.location,
        contractValue: values.contractValue,
        startDate: values.startDate,
        expectedEndDate: values.expectedEndDate || undefined,
        status: values.status,
        projectManagerEmployeeId: values.projectManagerEmployeeId || null,
        division: values.division,
        departmentType: values.departmentType,
        projectType: values.projectType,
        siteType: values.siteType,
        isHO: values.isHO,
        siteStartDate: values.siteStartDate || undefined,
        purchaseLimit: values.purchaseLimit
          ? Number(values.purchaseLimit)
          : undefined,
        orderNumber: values.orderNumber,
        cgstApplicable: values.cgstApplicable,
        // Percent in, fraction out — the single conversion in the system, so the two retention
        // terms the bill composer reads are never in different units.
        clientRetentionFraction: values.clientRetentionPercent?.trim()
          ? Number(values.clientRetentionPercent) / 100
          : undefined,
        description: values.description,
      };
      if (project) {
        return updateProject(project.id, {
          ...payload,
          isLocked: values.isLocked,
        });
      }
      // Omitted rather than sent empty, so the server allocates from the company
      // PROJECTS series. Sending '' would be a caller-supplied code of no characters.
      const withCode = values.code
        ? { ...payload, code: values.code }
        : payload;
      const ids = Object.values(staged).map((file) => file.stagedDocumentId);
      // Omitted when empty for the same reason as `code`: an empty array is a statement that no
      // documents were staged, which is only worth making when the server would otherwise assume
      // something. It would not.
      return createProject(
        ids.length > 0 ? { ...withCode, stagedDocumentIds: ids } : withCode,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Back to the portfolio list. The task text says "redirect to detail page on
      // save", but the project detail page is User Story 4 and is not built — the
      // list is where the saved project is visible today.
      router.push(ROUTES.projectsPortfolio);
    },
    onError: (error: unknown) => {
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      );
      // T072: the kinds the server named, kept so each control can say so for itself. Branching on
      // the code rather than on the message text, and reading the ids rather than the labels — two
      // kinds may legitimately share a name, and matching on one would attach the refusal to the
      // wrong control.
      if (
        error instanceof ApiError &&
        error.code === 'PROJECT_DOCUMENTS_MANDATORY_MISSING'
      ) {
        const ids = error.details?.missingTypeIds;
        setMissingTypeIds(Array.isArray(ids) ? ids.map(String) : []);
      }
      // Deliberately nothing else. `staged` is untouched, so every file already attached is still
      // attached and the next submission costs the user nothing.
    },
  });

  function onSubmit(values: ProjectFormValues) {
    setServerError(null);
    // Cleared here, not in `onError`: a refusal from a previous attempt must stay on its controls
    // until the user tries again, or the explanation vanishes before it has been read.
    setMissingTypeIds([]);
    // Confirmed only on the transition, not on every save of an already-locked
    // project — re-asking on each edit trains people to click through it.
    if (values.isLocked !== wasLocked) {
      const message = values.isLocked
        ? MESSAGES.projectLockConfirm
        : MESSAGES.projectUnlockConfirm;
      if (!window.confirm(message)) return;
    }
    mutation.mutate(values);
  }

  function handleCancel() {
    if (isDirty && !window.confirm(MESSAGES.discardChanges)) return;
    router.push(ROUTES.projectsPortfolio);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-8">
      <FormError message={serverError} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Basic information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="project-code"
            label="Project code"
            hint={
              project
                ? undefined
                : 'Leave blank to allocate the next code automatically.'
            }
            error={errors.code?.message}
            {...register('code')}
          />
          <TextField
            id="project-name"
            label="Project name"
            error={errors.name?.message}
            required
            {...register('name')}
          />
          <SelectField
            id="project-client"
            label="Client"
            error={errors.clientId?.message}
            required
            {...register('clientId')}
          >
            <option value="">Choose a client…</option>
            {clients?.items.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id="project-location"
            label="Location"
            error={errors.location?.message}
            {...register('location')}
          />
          <SelectField
            id="project-status"
            label="Status"
            error={errors.status?.message}
            {...register('status')}
          >
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {projectsLabel(value)}
              </option>
            ))}
          </SelectField>
          <TextField
            id="project-description"
            label="Description"
            error={errors.description?.message}
            {...register('description')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Contract
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="project-contract-value"
            label="Contract value (₹)"
            type="number"
            step="0.01"
            min={0}
            error={errors.contractValue?.message}
            required
            {...register('contractValue')}
          />
          <TextField
            id="project-purchase-limit"
            label="Purchase limit (₹)"
            type="number"
            step="0.01"
            min={0}
            error={errors.purchaseLimit?.message}
            {...register('purchaseLimit')}
          />
          <TextField
            id="project-order-number"
            label="Order number"
            error={errors.orderNumber?.message}
            {...register('orderNumber')}
          />
          <div className="flex items-end">
            <CheckboxField
              id="project-cgst"
              label="CGST applicable"
              {...register('cgstApplicable')}
            />
          </div>

          <TextField
            id="project-client-retention"
            label="Client retention (%)"
            hint="The contract's own term — 5 for 5%. Leave it empty and a bill to the client is refused rather than billed at zero retention."
            inputMode="decimal"
            error={errors.clientRetentionPercent?.message}
            {...register('clientRetentionPercent')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dates
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="project-start-date"
            label="Start date"
            type="date"
            error={errors.startDate?.message}
            required
            {...register('startDate')}
          />
          <TextField
            id="project-end-date"
            label="Expected end date"
            type="date"
            error={errors.expectedEndDate?.message}
            {...register('expectedEndDate')}
          />
          <TextField
            id="project-site-start-date"
            label="Site start date"
            type="date"
            error={errors.siteStartDate?.message}
            {...register('siteStartDate')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Assignment
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="project-manager"
            label="Project manager"
            error={errors.projectManagerEmployeeId?.message}
            {...register('projectManagerEmployeeId')}
          >
            <option value="">Not assigned</option>
            {employees?.items.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {[employee.firstName, employee.lastName]
                  .filter(Boolean)
                  .join(' ') || employee.employeeCode}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="project-division"
            label="Division"
            error={errors.division?.message}
            {...register('division')}
          >
            {PROJECT_DIVISIONS.map((value) => (
              <option key={value} value={value}>
                {projectsLabel(value)}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="project-site-type"
            label="Site type"
            error={errors.siteType?.message}
            {...register('siteType')}
          >
            {PROJECT_SITE_TYPES.map((value) => (
              <option key={value} value={value}>
                {projectsLabel(value)}
              </option>
            ))}
          </SelectField>
          <TextField
            id="project-department-type"
            label="Department type"
            error={errors.departmentType?.message}
            {...register('departmentType')}
          />
          <TextField
            id="project-type"
            label="Project type"
            error={errors.projectType?.message}
            {...register('projectType')}
          />
          <div className="flex items-end">
            <CheckboxField
              id="project-is-ho"
              label="Head office project"
              {...register('isHO')}
            />
          </div>
        </div>
      </section>

      {project && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Lock
          </h2>
          <CheckboxField
            id="project-is-locked"
            label="Lock this project"
            description={
              isLocked
                ? 'Data entry is disabled for everyone until this is unlocked.'
                : 'Locking disables BOQ, work reports, revenue and billing entry for everyone.'
            }
            {...register('isLocked')}
          />
        </section>
      )}

      {/*
        Creation only. An existing project is past FR-009's gate, and documents are filed against it
        through its own documents screen.

        `!project` is now redundant — `requirements` is already empty on an edit — and is kept
        deliberately: these two consumers disagreeing is what produced the defect reported on
        7 October, and a second statement of the same rule costs nothing.
      */}
      {!project && requirements.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {DOCUMENT_COPY.creationHeading}
          </h2>
          <ProjectDocumentUploads
            requirements={requirements}
            staged={staged}
            onStagedChange={setStaged}
            missingTypeIds={missingTypeIds}
            disabled={mutation.isPending}
          />
        </section>
      )}

      {/* Says where they went. The controls' absence on an edit is correct and unexplained
          absences send people hunting. */}
      {project && (
        <p className="text-sm text-gray-600">
          {DOCUMENT_COPY.editFiledElsewhere}{' '}
          <Link
            href={ROUTES.projectsProjectDocuments(project.id)}
            className="font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {DOCUMENT_COPY.editFiledElsewhereLink}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          // T070: refused in the form as well as on the server. The server's gate is the
          // authoritative one — it is the only one that cannot be bypassed — but letting somebody
          // fill a long form and submit it to learn something the page already knew is a waste of
          // their time.
          disabled={
            isSubmitting || mutation.isPending || outstanding.length > 0
          }
        >
          {mutation.isPending ? 'Saving…' : 'Save project'}
        </Button>
        <SecondaryButton type="button" onClick={handleCancel}>
          Cancel
        </SecondaryButton>
        {outstanding.length > 0 && (
          // The count, not the kinds: each kind says so on its own control, and repeating them
          // here is the matching exercise T072 exists to remove.
          <span className="text-sm text-amber-800">
            {DOCUMENT_COPY.creationBlocked(outstanding.length)}
          </span>
        )}
      </div>
    </form>
  );
}
