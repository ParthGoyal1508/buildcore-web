'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import { resendInvite } from '@/app/lib/api/account-creation';
import {
  AdminResetMethod,
  AdminResetResult,
  adminResetPassword,
} from '@/app/lib/api/auth';
import {
  listSelectableCompanies,
  useSelectedCompanyId,
} from '@/app/lib/api/company-selection';
import {
  UserSummary,
  deleteUser,
  listRoles,
  roleFitsCompany,
  listUsersPage,
  updateUser,
} from '@/app/lib/api/settings';
import { CurrentUser, getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import { formatLastLogin } from '@/app/lib/settings-utils';
import {
  urlEnum,
  urlNumber,
  urlSort,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import Pager from '@/app/ui/inventory/pager';
import QueryError from '@/app/ui/query-error';
import { mayAssignRole } from '@/app/ui/settings/grant-ceiling';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { toast } from '@/app/ui/toast';

/** Add/Edit user — roles and status only. Accounts are never created here; that is
 * feature 010's invite flow. */
function UserModal({
  user,
  me,
  onClose,
}: {
  user: UserSummary;
  me: CurrentUser | undefined;
  onClose: () => void;
}) {
  const initialRoles = user.roles.map((r) => r.id);
  // 036 C1 (decision 8): the whole role set. The form used to edit `roles[0]` alone, and saving
  // replaced the account's roles with that one — a multi-role user silently lost the rest.
  const [roleIds, setRoleIds] = useState<string[]>(initialRoles);
  const [status, setStatus] = useState(user.status);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isSelf = user.id === me?.id;

  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  // Another company's own role cannot be held by this account (036 C10); one already held stays
  // listed so it can be removed.
  const assignableRoles = (roles.data ?? []).filter(
    (role) =>
      roleFitsCompany(role, user.companyId) || initialRoles.includes(role.id),
  );

  const rolesChanged =
    roleIds.length !== initialRoles.length ||
    roleIds.some((id) => !initialRoles.includes(id));
  const statusChanged = status !== user.status && status !== 'pending';
  const isDirty = rolesChanged || statusChanged;

  const mutation = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        ...(rolesChanged ? { roleIds } : {}),
        // `pending` is never sent: only accepting the invite makes an account active, and the
        // API refuses to set it directly (010 FR-008).
        ...(statusChanged ? { status: status as 'active' | 'deactivated' } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`${user.name} updated.`);
      onClose();
    },
    // The 409 here is the last-active-Super-Admin protection, the 403s are the grant ceiling and
    // the own-account rules. Their messages are shown verbatim (spec FR-013): the backend states
    // the rule better than a generic "could not save" would. The form keeps what was entered.
    onError: (error: unknown) =>
      setServerError(errorMessage(error, MESSAGES.saveFailed)),
  });

  const toggleRole = (id: string, on: boolean) =>
    setRoleIds((current) =>
      on ? [...current, id] : current.filter((r) => r !== id),
    );

  return (
    <Modal
      title={`Edit ${user.name}`}
      onClose={onClose}
      isDirty={isDirty}
      pending={mutation.isPending}
      footer={
        <>
          <SecondaryButton
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="user-form"
            loading={mutation.isPending}
            disabled={!isDirty || roleIds.length === 0}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="user-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setServerError(null);
          if (roleIds.length === 0) {
            setServerError('Choose at least one role.');
            return;
          }
          mutation.mutate();
        }}
      >
        <FormError message={serverError} />
        <p className="text-sm text-gray-600">{user.email}</p>

        <fieldset aria-describedby="user-roles-hint">
          <legend className="mb-1 block text-sm font-medium text-gray-700">
            Roles <span className="text-red-600" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </legend>
          <p id="user-roles-hint" className="mb-2 text-xs text-gray-500">
            {isSelf
              ? 'You cannot change your own roles. Ask another administrator.'
              : 'An account can hold several roles; its access is all of them together.'}
          </p>
          {roles.isLoading ? (
            <ListSkeleton headers={['Role']} rows={3} cards />
          ) : roles.isError ? (
            <QueryError
              error={roles.error}
              onRetry={roles.refetch}
              compact
              fallback="The roles could not be loaded."
            />
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3">
              {assignableRoles.map((role) => {
                const held = initialRoles.includes(role.id);
                // A role the caller could not grant stays as it is: ticked if held (the server
                // leaves a held role alone), unavailable to add (036 C10 — refused up front, not
                // after Save).
                const grantable = held || mayAssignRole(me, role);
                return (
                  <CheckboxField
                    key={role.id}
                    id={`user-role-${role.id}`}
                    label={role.name}
                    description={
                      grantable
                        ? undefined
                        : 'Grants more than your own role, so you cannot assign it.'
                    }
                    checked={roleIds.includes(role.id)}
                    disabled={isSelf || !grantable}
                    onChange={(event) =>
                      toggleRole(role.id, event.target.checked)
                    }
                  />
                );
              })}
            </div>
          )}
          {roleIds.length === 0 && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              Choose at least one role. To stop someone signing in, deactivate the account.
            </p>
          )}
        </fieldset>

        {/* Not on your own account: the API refuses deactivating yourself (036 C3, OWN_ACCOUNT). */}
        {!isSelf && (
          <SelectField
            id="user-status"
            label="Status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as UserSummary['status'])
            }
          >
            {user.status === 'pending' ? (
              // An invited account can only stay invited or be cancelled; it becomes active when
              // its holder sets a password.
              <>
                <option value="pending">Invite pending</option>
                <option value="deactivated">Deactivated (cancel the invite)</option>
              </>
            ) : (
              <>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </>
            )}
          </SelectField>
        )}
        {status === 'deactivated' && user.status !== 'deactivated' && (
          <p className="text-sm text-gray-600">
            They will be signed out on every device and told by email.
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * Getting someone back into their account (029 FR-014).
 *
 * The link is offered first and preselected: the holder chooses their own password and the admin
 * never knows it. A temporary password is for someone who cannot reach their inbox — and is then
 * shown once, here, with the instruction that matters: hand it over in person or by phone, not in
 * a chat or an email that will keep it.
 */
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserSummary;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<AdminResetMethod>('link');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = useMutation({
    mutationFn: () => adminResetPassword(user.id, method),
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });
  const result: AdminResetResult | undefined = reset.data;

  if (result) {
    return (
      <Modal
        title={`Password reset for ${user.name}`}
        onClose={onClose}
        footer={
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-3 text-sm text-gray-700" role="status">
          {result.method === 'link' ? (
            <p>
              A reset link has been emailed to <strong>{user.email}</strong>. It works once and
              expires in 24 hours. Their current password keeps working until they use it.
            </p>
          ) : (
            <>
              <p>
                {user.name} has been signed out everywhere. Give them this temporary password —
                they will choose their own when they next sign in.
              </p>
              {result.temporaryPassword && (
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 select-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-base tracking-wider text-gray-900"
                    aria-label="Temporary password"
                  >
                    {result.temporaryPassword}
                  </code>
                  <SecondaryButton
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.temporaryPassword ?? '');
                        setCopied(true);
                      } catch {
                        // Clipboard access can be refused (an insecure origin, a denied
                        // permission); the value is selectable either way.
                      }
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </SecondaryButton>
                </div>
              )}
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                It is shown only this once. Share it in person or by phone, not by email or
                chat.
              </p>
            </>
          )}
          {result.emailDispatchFailed && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
              {result.method === 'link'
                ? 'The reset email could not be sent. Try again in a few minutes, or use a temporary password instead.'
                : 'The password was reset, but the email telling them so could not be sent.'}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Reset password for ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="reset-password-form"
            disabled={reset.isPending}
          >
            {reset.isPending
              ? 'Resetting…'
              : method === 'link'
                ? 'Email reset link'
                : 'Set temporary password'}
          </Button>
        </>
      }
    >
      <form
        id="reset-password-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          reset.mutate();
        }}
      >
        <FormError message={error} />
        <fieldset className="space-y-3">
          <legend className="sr-only">How should they get back in?</legend>
          <label className="flex gap-3 rounded-md border border-gray-200 p-3 text-sm has-[:checked]:border-accent-500 has-[:checked]:bg-accent-50">
            <input
              type="radio"
              name="reset-method"
              value="link"
              checked={method === 'link'}
              onChange={() => setMethod('link')}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-gray-900">
                Email a reset link (recommended)
              </span>
              <span className="text-gray-600">
                Sent to {user.email}. They choose their own password; you never see it.
              </span>
            </span>
          </label>
          <label className="flex gap-3 rounded-md border border-gray-200 p-3 text-sm has-[:checked]:border-accent-500 has-[:checked]:bg-accent-50">
            <input
              type="radio"
              name="reset-method"
              value="temporary_password"
              checked={method === 'temporary_password'}
              onChange={() => setMethod('temporary_password')}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-gray-900">
                Set a temporary password
              </span>
              <span className="text-gray-600">
                For someone who cannot get to their email. Signs them out everywhere now;
                they must change it at their next sign-in.
              </span>
            </span>
          </label>
        </fieldset>
      </form>
    </Modal>
  );
}

/** A message another screen leaves for this list to show once (029) — see create-user-form. */
export const USERS_NOTICE_KEY = ['flash', 'users-notice'] as const;
type Notice = { tone: 'ok' | 'warn'; text: string };

const STATUS_BADGE: Record<UserSummary['status'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Invite pending', className: 'bg-amber-100 text-amber-800' },
  deactivated: { label: 'Deactivated', className: 'bg-gray-200 text-gray-600' },
};

const STATUS_FILTERS = ['', 'active', 'pending', 'deactivated'] as const;
const PAGE_SIZE = 25;

export default function UserList() {
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const queryClient = useQueryClient();
  // Read once and dropped, so it is not shown again on the next visit.
  const [notice, setNotice] = useState<Notice | null>(() => {
    const left = queryClient.getQueryData<Notice>(USERS_NOTICE_KEY) ?? null;
    queryClient.removeQueries({ queryKey: USERS_NOTICE_KEY });
    return left;
  });

  // 036 C5: search, filters, sort and page in the URL, searched and paged on the server.
  const [filters, setFilters, query] = useUrlState(
    {
      q: urlString(),
      status: urlEnum(STATUS_FILTERS, ''),
      role: urlString(),
      company: urlString(),
      sort: urlSort(),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );

  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  // A cross-company administrator with no company selected sees every company's accounts, so the
  // list says whose each one is (036 C5).
  const crossCompany = me?.permissions.includes('CROSS_COMPANY_ACCESS') ?? false;
  const selected = useSelectedCompanyId();
  const showCompany = crossCompany && !selected;

  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const companies = useQuery({
    queryKey: ['companies', 'selectable'],
    queryFn: listSelectableCompanies,
    enabled: showCompany,
  });
  const companyName = (id: string | null) =>
    (id && companies.data?.find((c) => c.id === id)?.name) || '—';

  const users = useQuery({
    queryKey: ['users', 'page', query],
    queryFn: () =>
      listUsersPage({
        q: query.q.trim() || undefined,
        status: query.status,
        roleId: query.role || undefined,
        companyId: showCompany ? query.company || undefined : undefined,
        sort: query.sort ? `${query.sort.key}:${query.sort.dir}` : undefined,
        page: query.page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const resend = useMutation({
    mutationFn: (user: UserSummary) => resendInvite(user.id),
    onSuccess: ({ emailDispatchFailed }, user) =>
      setNotice(
        emailDispatchFailed
          ? {
              tone: 'warn',
              text: `A new invite for ${user.email} was created, but the email could not be sent. Try again in a few minutes.`,
            }
          : {
              tone: 'ok',
              text: `A new invite has been emailed to ${user.email}. Earlier invite links no longer work.`,
            },
      ),
    onError: (error: unknown) =>
      toast.error(errorMessage(error, MESSAGES.saveFailed)),
  });

  const removal = useMutation({
    mutationFn: (user: UserSummary) => deleteUser(user.id),
    onSuccess: (_d, user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`${user.name}'s account was deleted.`);
    },
    onError: (error: unknown) =>
      toast.error(errorMessage(error, MESSAGES.saveFailed)),
  });

  const confirmDelete = async (user: UserSummary) => {
    const ok = await confirmDialog({
      title: 'Delete account',
      message: `${MESSAGES.confirmDelete('account', user.name)} They will no longer be able to sign in.`,
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (ok) removal.mutate(user);
  };

  const columns: Column<UserSummary>[] = [
    { key: 'name', header: 'Name', render: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'roles',
      header: 'Roles',
      sortable: false,
      // An account can hold several roles at once; all of them are shown, since
      // its access is their union.
      render: (u) =>
        u.roles.length === 0 ? (
          <span className="text-gray-500">No role</span>
        ) : (
          u.roles.map((r) => r.name).join(', ')
        ),
    },
    ...(showCompany
      ? [
          {
            key: 'company',
            header: 'Company',
            sortable: false,
            render: (u: UserSummary) => companyName(u.companyId),
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs ${STATUS_BADGE[u.status].className}`}
        >
          {STATUS_BADGE[u.status].label}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (u) => formatLastLogin(u.lastLoginAt),
    },
  ];

  const page = users.data;
  const filtered =
    Boolean(query.q.trim()) || Boolean(query.status) || Boolean(query.role) || Boolean(query.company);

  return (
    <>
      <div className="mb-4 flex justify-end">
        {/* Feature 010's invite flow now exists, so this links rather than sitting
            disabled. A link, not a button with an onClick — it is navigation, so it
            should behave like one for middle-click, keyboard and screen readers. */}
        <Link
          href="/dashboard/account-creation/new"
          className="flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Add user
        </Link>
      </div>

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'bg-green-50 text-green-800'
              : 'bg-amber-50 text-amber-900'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="users-search"
          label="Search"
          type="search"
          placeholder="Name, username or email"
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
        />
        <SelectField
          id="users-status"
          label="Status"
          value={filters.status}
          onChange={(event) =>
            setFilters({
              status: event.target.value as (typeof STATUS_FILTERS)[number],
            })
          }
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Invite pending</option>
          <option value="deactivated">Deactivated</option>
        </SelectField>
        <SelectField
          id="users-role"
          label="Role"
          value={filters.role}
          onChange={(event) => setFilters({ role: event.target.value })}
        >
          <option value="">All roles</option>
          {(roles.data ?? []).map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </SelectField>
        {showCompany && (
          <SelectField
            id="users-company"
            label="Company"
            value={filters.company}
            onChange={(event) => setFilters({ company: event.target.value })}
          >
            <option value="">All companies</option>
            {(companies.data ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <ResponsiveList
        columns={columns}
        rows={page?.items ?? []}
        rowKey={(u) => u.id}
        isLoading={users.isLoading}
        error={users.isError ? users.error : null}
        onRetry={users.refetch}
        isRefreshing={users.isPlaceholderData}
        sort={filters.sort}
        onSortChange={(sort) => setFilters({ sort })}
        serverPaged
        emptyMessage={
          filtered ? 'No accounts match these filters.' : 'No accounts yet.'
        }
        actions={(user) => {
          const isSelf = user.id === me?.id;
          return (
            // Allowed to wrap: with Reset password or Resend invite beside Edit and Delete (029) a
            // row's actions outgrow the column at laptop widths, and the table scrolling sideways
            // hid Delete off the edge rather than showing it.
            <div className="flex flex-wrap justify-end gap-2 md:w-60">
              <RowAction type="button" onClick={() => setEditing(user)}>
                Edit
              </RowAction>
              {user.status === 'pending' && (
                <RowAction
                  type="button"
                  loading={resend.isPending && resend.variables?.id === user.id}
                  disabled={resend.isPending}
                  onClick={() => {
                    setNotice(null);
                    resend.mutate(user);
                  }}
                >
                  Resend invite
                </RowAction>
              )}
              {/* Not on your own row: your own password is changed from your profile, with the
                  current one — the API refuses this route for it. */}
              {user.status === 'active' && !isSelf && (
                <RowAction type="button" onClick={() => setResetting(user)}>
                  Reset password
                </RowAction>
              )}
              {/* Not on your own row either: the API refuses deleting your own account (036 C3,
                  OWN_ACCOUNT) — another administrator does it. */}
              {!isSelf && (
                <RowAction
                  type="button"
                  loading={removal.isPending && removal.variables?.id === user.id}
                  disabled={removal.isPending}
                  onClick={() => void confirmDelete(user)}
                  className="text-red-600"
                >
                  Delete
                </RowAction>
              )}
            </div>
          );
        }}
      />

      {page && (
        <div className="mt-4">
          <Pager
            total={page.total}
            page={page.page}
            pageSize={page.pageSize}
            onPageChange={(next) => setFilters({ page: next })}
            noun="account"
          />
        </div>
      )}

      {editing && (
        <UserModal user={editing} me={me} onClose={() => setEditing(null)} />
      )}

      {resetting && (
        <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
      )}
    </>
  );
}
