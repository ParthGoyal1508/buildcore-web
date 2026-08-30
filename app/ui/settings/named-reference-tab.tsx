'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import { NamedReference } from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { useCompanyContext } from '@/app/ui/settings/company-context';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Departments and Designations are the same screen with a different noun and
 * endpoint — one name-keyed, per-company list with add/edit/delete and a
 * duplicate-name conflict. Parameterized here rather than written twice, mirroring
 * how `ReferenceDataService` parameterizes the same three resources on the backend.
 */
export default function NamedReferenceTab({
  resource,
  singular,
  plural,
  api,
}: {
  resource: string;
  singular: string;
  plural: string;
  api: {
    list: (companyId?: string) => Promise<NamedReference[]>;
    create: (input: { companyId?: string; name: string }) => Promise<NamedReference>;
    update: (id: string, input: { name: string }) => Promise<NamedReference>;
    remove: (id: string) => Promise<void>;
  };
}) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<NamedReference | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirming, setConfirming] = useState<NamedReference | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryKey = [resource, companyId] as const;
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => api.list(companyId ?? undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [resource] });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.update(editing.id, { name: name.trim() })
        : api.create({
            ...(companyId ? { companyId } : {}),
            name: name.trim(),
          }),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    // 409 is a duplicate name within this company — shown inline on the field
    // rather than as a banner (spec FR-015).
    onError: (error: unknown) =>
      setFormError(error instanceof ApiError ? error.message : MESSAGES.saveFailed),
  });

  const removal = useMutation({
    mutationFn: (row: NamedReference) => api.remove(row.id),
    onSuccess: () => {
      invalidate();
      setConfirming(null);
    },
    // 409 here means an employee still references it (spec FR-015).
    onError: (error: unknown) =>
      setDeleteError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  function openCreate() {
    setName('');
    setFormError(null);
    setIsCreating(true);
  }

  function openEdit(row: NamedReference) {
    setName(row.name);
    setFormError(null);
    setEditing(row);
  }

  function closeForm() {
    setIsCreating(false);
    setEditing(null);
    setName('');
  }

  const columns: Column<NamedReference>[] = [
    { key: 'name', header: singular, render: (row) => row.name },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openCreate}>
          Add {singular.toLowerCase()}
        </Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage={`No ${plural.toLowerCase()} for this company yet.`}
        actions={(row) => (
          <>
            <RowAction type="button" onClick={() => openEdit(row)}>
              Edit
            </RowAction>
            <RowAction
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirming(row);
              }}
              className="text-red-600"
            >
              Delete
            </RowAction>
          </>
        )}
      />

      {(isCreating || editing) && (
        <Modal
          title={editing ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
          onClose={closeForm}
          footer={
            <>
              <SecondaryButton type="button" onClick={closeForm}>
                Cancel
              </SecondaryButton>
              <Button type="submit" form="named-reference-form" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <form
            id="named-reference-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              if (!name.trim()) {
                setFormError(`${singular} name is required.`);
                return;
              }
              save.mutate();
            }}
          >
            <TextField
              id="reference-name"
              label={`${singular} name`}
              value={name}
              error={formError ?? undefined}
              onChange={(event) => setName(event.target.value)}
            />
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal
          title={`Delete ${singular.toLowerCase()}`}
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
                {removal.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <FormError message={deleteError} />
            <p className="text-sm text-gray-700">
              {MESSAGES.confirmDelete(singular.toLowerCase(), confirming.name)}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
