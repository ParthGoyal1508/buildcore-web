'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import { resendInvite } from '@/app/lib/api/account-creation';
import {
  AdminResetMethod,
  AdminResetResult,
  adminResetPassword,
} from '@/app/lib/api/auth';
import {
  UserSummary,
  deleteUser,
  listRoles,
  listUsers,
  updateUser,
} from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import { formatLastLogin } from '@/app/lib/settings-utils';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';

/** Add/Edit user — role and status only. Accounts are never created here; that is
 * feature 010's invite flow. */
function UserModal({
  user,
  onClose,
}: {
  user: UserSummary;
  onClose: () => void;
}) {
  const [roleId, setRoleId] = useState(user.roles[0]?.id ?? '');
  const [status, setStatus] = useState(user.status);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles });

  const mutation = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        ...(roleId && roleId !== user.roles[0]?.id ? { roleId } : {}),
        // `pending` is never sent: only accepting the invite makes an account active, and the
        // API refuses to set it directly (010 FR-008).
        ...(status !== user.status && status !== 'pending' ? { status } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    // The 409 here is the last-active-Super-Admin protection. Its message is shown
    // verbatim (spec FR-013): the backend states the rule better than a generic
    // "could not save" would.
    onError: (error: unknown) =>
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  return (
    <Modal
      title={`Edit ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="user-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
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
          mutation.mutate();
        }}
      >
        <FormError message={serverError} />
        <p className="text-sm text-gray-600">{user.email}</p>

        <SelectField
          id="user-role"
          label="Role"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
        >
          <option value="">— No role —</option>
          {(roles ?? []).map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </SelectField>

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

export default function UserList() {
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [confirming, setConfirming] = useState<UserSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Read once and dropped, so it is not shown again on the next visit.
  const [notice, setNotice] = useState<Notice | null>(() => {
    const left = queryClient.getQueryData<Notice>(USERS_NOTICE_KEY) ?? null;
    queryClient.removeQueries({ queryKey: USERS_NOTICE_KEY });
    return left;
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });
  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
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
      setNotice({
        tone: 'warn',
        text: error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      }),
  });

  const removal = useMutation({
    mutationFn: (user: UserSummary) => deleteUser(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setConfirming(null);
    },
    onError: (error: unknown) =>
      setDeleteError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  const columns: Column<UserSummary>[] = [
    { key: 'name', header: 'Name', render: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'roles',
      header: 'Role',
      // An account can hold several roles at once; all of them are shown, since
      // its access is their union.
      render: (u) =>
        u.roles.length === 0 ? (
          <span className="text-gray-500">No role</span>
        ) : (
          u.roles.map((r) => r.name).join(', ')
        ),
    },
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
      key: 'lastLogin',
      header: 'Last login',
      render: (u) => formatLastLogin(u.lastLoginAt),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        {/* Feature 010's invite flow now exists, so this links rather than sitting
            disabled. A link, not a button with an onClick — it is navigation, so it
            should behave like one for middle-click, keyboard and screen readers. */}
        <Link
          href="/dashboard/account-creation/new"
          className="flex h-10 items-center rounded-lg bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        actions={(user) => (
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
            {user.status === 'active' && user.id !== me?.id && (
              <RowAction type="button" onClick={() => setResetting(user)}>
                Reset password
              </RowAction>
            )}
            <RowAction
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirming(user);
              }}
              className="text-red-600"
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}

      {resetting && (
        <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
      )}

      {confirming && (
        <Modal
          title="Delete account"
          onClose={() => setConfirming(null)}
          footer={
            <>
              <SecondaryButton type="button" onClick={() => setConfirming(null)}>
                Cancel
              </SecondaryButton>
              <Button
                type="button"
                onClick={() => removal.mutate(confirming)}
                disabled={removal.isPending}
                className="bg-red-600 hover:bg-red-500 focus-visible:outline-red-600 active:bg-red-700"
              >
                {removal.isPending ? 'Deleting…' : 'Delete account'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <FormError message={deleteError} />
            <p className="text-sm text-gray-700">
              {MESSAGES.confirmDelete('account', confirming.name)} They will no
              longer be able to sign in.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
