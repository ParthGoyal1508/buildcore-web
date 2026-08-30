'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  DocumentType,
  createDocumentType,
  listDocumentTypes,
  updateDocumentType,
} from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import { computeDocumentTypeFlag } from '@/app/lib/settings-utils';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { useCompanyContext } from '@/app/ui/settings/company-context';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

interface FormState {
  code: string;
  name: string;
  isMandatory: boolean;
  hasExpiry: boolean;
  needsNumber: boolean;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: FormState = {
  code: '',
  name: '',
  isMandatory: false,
  hasExpiry: false,
  needsNumber: false,
  sortOrder: 0,
  isActive: true,
};

export default function DocumentTypeTab() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['document-types', companyId],
    queryFn: () => listDocumentTypes(companyId ?? undefined),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateDocumentType(editing.id, form)
        : createDocumentType({ ...(companyId ? { companyId } : {}), ...form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      close();
    },
    onError: (error: unknown) =>
      setFormError(error instanceof ApiError ? error.message : MESSAGES.saveFailed),
  });

  // Toggling Active is a one-click action from the row — this is how a document
  // type is retired, since there is no delete (spec FR-016).
  const toggleActive = useMutation({
    mutationFn: (row: DocumentType) =>
      updateDocumentType(row.id, { isActive: !row.isActive }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['document-types'] }),
  });

  function openCreate() {
    setForm(EMPTY);
    setFormError(null);
    setIsCreating(true);
  }

  function openEdit(row: DocumentType) {
    setForm({
      code: row.code,
      name: row.name,
      isMandatory: row.isMandatory,
      hasExpiry: row.hasExpiry,
      needsNumber: row.needsNumber,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setFormError(null);
    setEditing(row);
  }

  function close() {
    setIsCreating(false);
    setEditing(null);
    setForm(EMPTY);
  }

  // The same derivation the API applies on read, run locally so the modal can show
  // the resulting flag *before* saving (spec US5, Acceptance Scenario 1).
  const previewFlag = computeDocumentTypeFlag(
    form.isMandatory,
    form.hasExpiry,
    form.needsNumber,
  );

  const columns: Column<DocumentType>[] = [
    { key: 'name', header: 'Type', render: (d) => d.name },
    { key: 'code', header: 'Code', render: (d) => d.code },
    {
      key: 'flag',
      header: 'Flags',
      render: (d) => (
        <span className="rounded bg-gray-100 px-2 py-1 text-xs">{d.flag}</span>
      ),
    },
    { key: 'sortOrder', header: 'Sort', render: (d) => d.sortOrder, hideOnCard: true },
    {
      key: 'isActive',
      header: 'Active',
      render: (d) => (d.isActive ? 'Yes' : 'No'),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openCreate}>
          Add document type
        </Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No document types for this company yet."
        actions={(row) => (
          <>
            <RowAction type="button" onClick={() => openEdit(row)}>
              Edit
            </RowAction>
            <RowAction
              type="button"
              onClick={() => toggleActive.mutate(row)}
              disabled={toggleActive.isPending}
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </RowAction>
          </>
        )}
      />

      {(isCreating || editing) && (
        <Modal
          title={editing ? `Edit ${editing.name}` : 'Add document type'}
          onClose={close}
          footer={
            <>
              <SecondaryButton type="button" onClick={close}>
                Cancel
              </SecondaryButton>
              <Button type="submit" form="document-type-form" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <form
            id="document-type-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              if (!form.code.trim() || !form.name.trim()) {
                setFormError('Code and name are both required.');
                return;
              }
              save.mutate();
            }}
          >
            <FormError message={formError} />

            <TextField
              id="dt-code"
              label="Code"
              value={form.code}
              hint="Unique within the company, e.g. AADHAAR."
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <TextField
              id="dt-name"
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700">Flags</legend>
              <CheckboxField
                id="dt-mandatory"
                label="Mandatory"
                description="Blocks attendance for an employee missing this document."
                checked={form.isMandatory}
                onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })}
              />
              <CheckboxField
                id="dt-expiry"
                label="Has expiry date"
                checked={form.hasExpiry}
                onChange={(e) => setForm({ ...form, hasExpiry: e.target.checked })}
              />
              <CheckboxField
                id="dt-number"
                label="Needs document number"
                checked={form.needsNumber}
                onChange={(e) => setForm({ ...form, needsNumber: e.target.checked })}
              />
            </fieldset>

            {/* Live preview — updates as the toggles change, before any save. */}
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm" aria-live="polite">
              Derived flag:{' '}
              <span className="font-medium text-gray-900">{previewFlag}</span>
            </p>

            <TextField
              id="dt-sort"
              label="Sort order"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: Number(e.target.value) })
              }
            />
            <CheckboxField
              id="dt-active"
              label="Active"
              description="Inactive types are hidden from new uploads; existing records keep them."
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
