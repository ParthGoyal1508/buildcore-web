'use client';

import { getCurrentUser } from '@/app/lib/api/users';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '@/app/lib/api/client';
import {
  createUser,
  createUserSchema,
  passwordRules,
  searchUnlinkedEmployees,
} from '@/app/lib/api/account-creation';
import {
  listSelectableCompanies,
  useSelectedCompanyId,
} from '@/app/lib/api/company-selection';
import { listGrantableRoles } from '@/app/lib/api/settings';
import { USERS_NOTICE_KEY } from '@/app/ui/settings/user-list';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import QueryError from '@/app/ui/query-error';
import { mayAssignRole } from '@/app/ui/settings/grant-ceiling';
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
  // Empty means "send an invite" — the two modes differ by whether this is filled
  // in, not by a separate control (backend FR-015).
  const [password, setPassword] = useState('');
  const [employeeOption, setEmployeeOption] = useState<SearchableOption | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // The server's own grantable list (042): `?grantable=true` returns only the roles the caller
  // may actually assign, by the same ceiling the invite endpoint enforces on submit. Under
  // `['roles', 'grantable']` — a child of the Roles screen's `['roles']`, so a role created or
  // edited there still invalidates this list, while the two never serve from each other's cache
  // (the Roles screen must keep showing roles the viewer cannot grant).
  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles', 'grantable'],
    queryFn: listGrantableRoles,
  });
  // Only roles the creator may give (2026-10-16 access-control audit, C2): the API refuses a role
  // carrying any permission its creator lacks — Super Admin, for a company administrator — so the
  // list does not offer one. MY_WORKSPACE is open to everybody and grants nothing.
  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  // The same ceiling the Users screen applies, levels included (036 C10) — kept as
  // belt-and-braces over the server's own filtering above.
  const roles = allRoles.filter((role) => mayAssignRole(me, role));
  // The companies the caller may work in — exactly their own for a company administrator — rather
  // than the Companies settings list, which needs COMPANY_SETTINGS an account administrator may
  // not hold (036 C18).
  const { data: companies = [] } = useQuery({
    queryKey: ['companies', 'selectable'],
    queryFn: listSelectableCompanies,
  });
  // 036 C18: a company administrator can only create accounts in their own company — the API
  // scopes them there — so the field is fixed rather than offering every company and failing.
  // A group administrator gets the selected company preselected and may change it.
  const isGroupAdmin = me?.permissions.includes(CROSS_COMPANY_ACCESS) ?? false;
  const selectedCompanyId = useSelectedCompanyId();
  const lockedCompany = !isGroupAdmin && companies.length === 1 ? companies[0] : null;

  // The default role is preselected (029 FR-001) — derived rather than written into state once
  // the roles load, so the choice is still the admin's the moment they touch the field.
  const defaultRole = roles.find((r) => r.isDefault);
  const effectiveRoleId = roleId || defaultRole?.id || '';
  const selectedRole = roles.find((r) => r.id === effectiveRoleId);
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
  const effectiveCompanyId = roleIsCrossCompany
    ? ''
    : lockedCompany?.id || companyId || selectedCompanyId || '';
  const effectiveNameSource: NameSource = roleIsCrossCompany
    ? 'displayName'
    : nameSource;
  const effectiveEmployeeId = roleIsCrossCompany ? '' : employeeId;

  /**
   * The employees without an account yet (036 C17, C18): searched on the server by name or code,
   * a page at a time, through `AsyncSelect`. The plain select listed codes only, searched on every
   * keystroke, and — when the request failed — said "Every employee already has an account."
   * Now a failure shows as a failure, with Retry, inside the picker.
   */
  const searchEmployees = (term: string, page: number) =>
    searchUnlinkedEmployees(effectiveCompanyId, term, page).then((r) => ({
      items: r.items.map((e) => ({
        id: e.id,
        label: e.name || e.employeeCode,
        note: e.name ? e.employeeCode : undefined,
      })),
      total: r.total,
    }));
  // Whether anyone is left to invite at all, for the "everyone has an account" note — asked once
  // per company, and only believed when it actually answered.
  const anyUnlinked = useQuery({
    queryKey: ['account-creation', 'unlinked-employees', effectiveCompanyId, 'any'],
    queryFn: () => searchUnlinkedEmployees(effectiveCompanyId, '', 1),
    enabled: effectiveNameSource === 'employee' && Boolean(effectiveCompanyId),
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (created) => {
      // The new account appears in 002's list, so its cache is stale now.
      // `['users']` is the key the Users list actually reads; the other is kept for anything
      // still keyed the older way.
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] });
      // A password set here opens the account at once and sends a welcome rather than an
      // invite (029 FR-031), so the two say different things.
      const direct = created.status === 'active';
      const message = direct
        ? created.emailDispatchFailed
          ? `Account created for ${created.email}, but the welcome email could not be sent. Give them the password you set; they will choose their own at first sign-in.`
          : `Account created for ${created.email}. Give them the password you set; they will choose their own at first sign-in.`
        : created.emailDispatchFailed
          ? `Account created, but the invite email could not be sent to ${created.email}. Use Resend invite to try again.`
          : `Invite sent to ${created.email}.`;
      // Handed over in memory, not in the URL: nothing read the `?notice=` it used to travel in,
      // and text a page renders from its own URL is text anyone can put there with a link.
      queryClient.setQueryData(USERS_NOTICE_KEY, {
        tone: created.emailDispatchFailed ? 'warn' : 'ok',
        text: message,
      });
      router.push('/dashboard/settings/users');
    },
    onError: (error: unknown) => {
      // 409s carry the backend's distinct wording — active vs deactivated vs
      // already-pending each need a different next step, so they are shown as
      // written rather than flattened into one message.
      setFormError(
        errorMessage(error, 'Could not create the account. Please try again.'),
      );
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = createUserSchema.safeParse({
      email,
      roleId: effectiveRoleId,
      companyId: effectiveCompanyId || undefined,
      employeeId:
        effectiveNameSource === 'employee'
          ? effectiveEmployeeId || undefined
          : undefined,
      displayName:
        effectiveNameSource === 'displayName'
          ? displayName || undefined
          : undefined,
      password: password || undefined,
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
        value={effectiveRoleId}
        error={fieldErrors.roleId}
        hint={
          selectedRole?.isDefault
            ? 'The default for new accounts: My Workspace only. Choose another role to give more access.'
            : undefined
        }
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
      {!roleIsCrossCompany && lockedCompany && (
        <TextField
          id="companyId"
          label="Company"
          value={lockedCompany.name}
          readOnly
          hint="Accounts you create belong to your company."
        />
      )}
      {!roleIsCrossCompany && !lockedCompany && (
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
            setEmployeeOption(null);
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
          <div>
            <label
              htmlFor="employeeId"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Employee
            </label>
            <AsyncSelect
              id="employeeId"
              value={effectiveEmployeeId}
              selectedOption={employeeOption}
              onChange={(id, option) => {
                setEmployeeId(id);
                setEmployeeOption(option);
              }}
              search={searchEmployees}
              cacheKey={['account-creation', 'unlinked-employees', effectiveCompanyId]}
              placeholder={
                effectiveCompanyId ? 'Search by name or code' : 'Choose a company first'
              }
              disabled={!effectiveCompanyId}
              invalid={Boolean(fieldErrors.displayName)}
              aria-describedby="employeeId-hint"
            />
            <p id="employeeId-hint" className="mt-1 text-xs text-gray-500">
              {effectiveCompanyId
                ? 'Only current employees without an account are listed.'
                : 'Choose a company first.'}
            </p>
            {fieldErrors.displayName && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {fieldErrors.displayName}
              </p>
            )}
            {anyUnlinked.isError && (
              <QueryError
                compact
                className="mt-2"
                error={anyUnlinked.error}
                onRetry={anyUnlinked.refetch}
                fallback="The employees could not be loaded."
              />
            )}
            {anyUnlinked.data?.total === 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Every current employee in this company already has an account.
              </p>
            )}
          </div>
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          How they get in
        </legend>
        <TextField
          id="password"
          label="Set a password (optional)"
          type="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          hint="Leave blank to email an invite and let them choose their own. Fill it in to create the account immediately — an email tells them where to sign in and their username, but never the password: you pass that on yourself, and they must change it when they first sign in."
          onChange={(e) => setPassword(e.target.value)}
        />
        {password.length > 0 && (
          <ul className="space-y-1 text-xs">
            {passwordRules.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={met ? 'text-green-700' : 'text-gray-500'}
                >
                  {met ? '✓' : '•'} {rule.label}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <FormError message={formError} />

      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending}>
          {password ? 'Create account' : 'Send invite'}
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
