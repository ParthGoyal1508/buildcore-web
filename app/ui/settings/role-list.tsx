'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import { Role, deleteRole, listRoles } from '@/app/lib/api/settings';
import { MESSAGES, permissionLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { FormError, RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import RoleModal from '@/app/ui/settings/role-modal';

export default function RoleList() {
  const [editing, setEditing] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirming, setConfirming] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['roles'],
    queryFn: listRoles,
  });

  const removal = useMutation({
    mutationFn: (role: Role) => deleteRole(role.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      // A deleted role changes who holds what, so the Users list is stale too.
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirming(null);
    },
    onError: (error: unknown) =>
      setDeleteError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  const columns: Column<Role>[] = [
    { key: 'name', header: 'Role', render: (r) => r.name },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (r) => (
        <span className="text-gray-600">
          {r.permissions.length === 0
            ? '—'
            : r.permissions.map(permissionLabel).join(', ')}
        </span>
      ),
      className: 'max-w-md',
    },
    { key: 'users', header: 'Users', render: (r) => r.assignedUserCount },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setIsCreating(true)}>
          Add role
        </Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        actions={(role) => (
          <>
            {/* The Super Admin role is immutable server-side; disabling here just
                explains why rather than letting the click fail with a 403. */}
            <RowAction
              type="button"
              disabled={role.isProtected}
              title={role.isProtected ? MESSAGES.protectedRole : undefined}
              onClick={() => setEditing(role)}
            >
              Edit
            </RowAction>
            <RowAction
              type="button"
              disabled={role.isProtected}
              title={role.isProtected ? MESSAGES.protectedRole : undefined}
              onClick={() => {
                setDeleteError(null);
                setConfirming(role);
              }}
              className="text-red-600"
            >
              Delete
            </RowAction>
          </>
        )}
      />

      {(isCreating || editing) && (
        <RoleModal
          role={editing}
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
        />
      )}

      {confirming && (
        <Modal
          title="Delete role"
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
                {removal.isPending ? 'Deleting…' : 'Delete role'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <FormError message={deleteError} />
            {/* Names the cascade explicitly — anyone holding this role loses the
                access it granted on their very next request (spec FR-009). */}
            <p className="text-sm text-gray-700">
              {MESSAGES.confirmDeleteRole(
                confirming.name,
                confirming.assignedUserCount,
              )}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
