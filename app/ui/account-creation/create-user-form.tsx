'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  createUser,
  createUserSchema,
  getUnlinkedEmployees,
} from '@/app/lib/api/account-creation';
import { listActiveCompanies, listRoles } from '@/app/lib/api/settings';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/** Roles carrying this are not scoped to one company (backend FR-020a). */
const CROSS_COMPANY_ACCESS = 'CROSS_COMPANY_ACCESS';

type NameSource = 'employee' | 'displayName';

/**
 * The invite form.
 *
 * Collects no password and no username: the invitee chooses their own password,
 * and the username is generated server-side. An admin never handles either, which
 * is the point of an invite flow.
 */
export default function CreateUserForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [nameSource, setNameSource] = useState<NameSource>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: listRoles,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ['settings', 'companies', 'active'],
    queryFn: listActiveCompanies,
  });

  const selectedRole = roles.find((r) => r.id === roleId);
  const roleIsCrossCompany = Boolean(
    selectedRole?.permissions.includes(CROSS_COMPANY_ACCESS),
  );

  // Derived during render rather than synced back into state by an effect. A
  // cross-company role is not scoped to a company and the backend rejects a
  // companyId for one, so those inputs are simply not read while such a role is
  // selected — and an employee belongs to a company, so with none there is nothing
  // to pick from and a typed name is the only option. Deriving also means switching
  // the role away restores whatever was chosen before, instead of having silently
  // destroyed it.
  const effectiveCompanyId = roleIsCrossCompany ? '' : companyId;
  const effectiveNameSource: NameSource = roleIsCrossCompany
    ? 'displayName'
    : nameSource;
  const effectiveEmployeeId = roleIsCrossCompany ? '' : employeeId;

  const { data: employees = [], isFetching: loadingEmployees } = useQuery({
    queryKey: [
      'account-creation',
      'unlinked-employees',
      effectiveCompanyId,
      employeeSearch,
    ],
    queryFn: () => getUnlinkedEmployees(effectiveCompanyId, employeeSearch),
    // Only meaningful once a company narrows the list.
    enabled: effectiveNameSource === 'employee' && Boolean(effectiveCompanyId),
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (created) => {
      // The new account appears in 002's list, so its cache is stale now.
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      const message = created.emailDispatchFailed
        ? `Account created, but the invite email could not be sent to ${created.email}. Use Resend invite to try again.`
        : `Invite sent to ${created.email}.`;
      router.push(
        `/dashboard/settings/users?notice=${encodeURIComponent(message)}`,
      );
    },
    onError: (error: unknown) => {
      // 409s carry the backend's distinct wording — active vs deactivated vs
      // already-pending each need a different next step, so they are shown as
      // written rather than flattened into one message.
      setFormError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not create the account. Please try again.',
      );
    },
  });

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.employeeCode}
        </option>
      )),
    [employees],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = createUserSchema.safeParse({
      email,
      roleId,
      companyId: effectiveCompanyId || undefined,
      employeeId:
        effectiveNameSource === 'employee'
          ? effectiveEmployeeId || undefined
          : undefined,
      displayName:
        effectiveNameSource === 'displayName' ? displayName || undefined : undefined,
      roleIsCrossCompany,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4" noValidate>
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="off"
        value={email}
        error={fieldErrors.email}
        hint="The invite link is sent here."
        onChange={(e) => setEmail(e.target.value)}
      />

      <SelectField
        id="roleId"
        label="Role"
        value={roleId}
        error={fieldErrors.roleId}
        onChange={(e) => setRoleId(e.target.value)}
      >
        <option value="">Select a role…</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </SelectField>

      {/* Hidden rather than disabled for a cross-company role: the field has no
          meaningful value in that case, and showing a greyed-out control invites
          the question of what it would do. */}
      {!roleIsCrossCompany && (
        <SelectField
          id="companyId"
          label="Company"
          value={effectiveCompanyId}
          error={fieldErrors.companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            // The picker lists employees of one company, so a previous pick is
            // meaningless once the company changes.
            setEmployeeId('');
          }}
        >
          <option value="">Select a company…</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </SelectField>
      )}

      <fieldset className="space-y-3 rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Who is this account for?
        </legend>

        {!roleIsCrossCompany && (
          <div className="flex gap-4">
            {(
              [
                ['employee', 'An existing employee'],
                ['displayName', 'Someone with no employee record'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="nameSource"
                  value={value}
                  checked={effectiveNameSource === value}
                  onChange={() => setNameSource(value)}
                />
                {label}
              </label>
            ))}
          </div>
        )}

        {effectiveNameSource === 'employee' ? (
          <>
            <TextField
              id="employeeSearch"
              label="Search employees"
              value={employeeSearch}
              disabled={!effectiveCompanyId}
              hint={
                effectiveCompanyId
                  ? 'Only employees without an account are listed.'
                  : 'Choose a company first.'
              }
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
            <SelectField
              id="employeeId"
              label="Employee"
              value={effectiveEmployeeId}
              error={fieldErrors.displayName}
              disabled={!effectiveCompanyId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">
                {loadingEmployees ? 'Loading…' : 'Select an employee…'}
              </option>
              {employeeOptions}
            </SelectField>
            {effectiveCompanyId && !loadingEmployees && employees.length === 0 && (
              <p className="text-sm text-gray-500">
                Every employee in this company already has an account.
              </p>
            )}
          </>
        ) : (
          <TextField
            id="displayName"
            label="Name"
            value={displayName}
            error={fieldErrors.displayName}
            hint="Shown in the account list."
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
      </fieldset>

      <FormError message={formError} />

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending invite…' : 'Send invite'}
        </Button>
        <SecondaryButton
          type="button"
          onClick={() => router.push('/dashboard/settings/users')}
        >
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}
