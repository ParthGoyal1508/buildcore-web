'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import { Role, createRole, updateRole } from '@/app/lib/api/settings';
import { MESSAGES, PERMISSIONS, permissionLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Add/Edit role.
 *
 * Permissions come from the fixed `PERMISSIONS` constant as real checkboxes — never
 * a free-text field (spec FR-007). The PRD's own mock had a comma-separated text
 * input here; that would let an admin type a value the API rejects, so it is
 * deliberately not reproduced.
 */
export default function RoleModal({
  role,
  onClose,
}: {
  role: Role | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [nameError, setNameError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      role
        ? updateRole(role.id, { name: name.trim(), permissions: selected })
        : createRole({ name: name.trim(), permissions: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        setNameError(error.message);
        return;
      }
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      );
    },
  });

  function toggle(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setServerError(null);
    if (!name.trim()) {
      setNameError('Role name is required');
      return;
    }
    if (selected.length === 0) {
      setServerError('Select at least one permission.');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      title={role ? `Edit ${role.name}` : 'Add role'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="role-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={onSubmit} className="space-y-4">
        <FormError message={serverError} />
        <TextField
          id="role-name"
          label="Role name"
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Permissions
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERMISSIONS.map((permission) => (
              <CheckboxField
                key={permission}
                id={`permission-${permission}`}
                label={permissionLabel(permission)}
                checked={selected.includes(permission)}
                onChange={() => toggle(permission)}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
