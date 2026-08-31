'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  UserSummary,
  deleteUser,
  listRoles,
  listUsers,
  updateUser,
} from '@/app/lib/api/settings';
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
        ...(status !== user.status ? { status } : {}),
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
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </SelectField>
      </form>
    </Modal>
  );
}

export default function UserList() {
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [confirming, setConfirming] = useState<UserSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
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
          className={`inline-flex rounded-full px-2 py-1 text-xs ${
            u.status === 'active'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {u.status === 'active' ? 'Active' : 'Deactivated'}
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

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        actions={(user) => (
          <>
            <RowAction type="button" onClick={() => setEditing(user)}>
              Edit
            </RowAction>
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
          </>
        )}
      />

      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}

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
