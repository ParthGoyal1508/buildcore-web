'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  getSignatories,
  upsertSignatory,
  type Signatory,
} from '@/app/lib/api/letters';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import QueryError from '@/app/ui/query-error';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { toast } from '@/app/ui/toast';

const QUERY_KEY = ['signatories'];

/** A signature keeps its exact pixels: compressing would blur the strokes and flatten a PNG. */
const SIGNATURE_ACCEPT = 'image/png,image/jpeg';
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Named signatories and their signature graphics (017 US4, FR-016).
 *
 * The 2026-09-15 clarification settled what "digital signature" means in this product:
 * an authorised signature **image** applied to a rendered letter, not a legally
 * recognised Digital Signature Certificate under the IT Act. Those differ in cost,
 * workflow and legal effect, and this screen implements the first.
 *
 * Note what is not here: the stored graphic is never displayed back. The server exposes no route
 * returning it, and it should not — a signature a browser can fetch is a signature anyone with the
 * link can paste onto a letter of their own. The thumbnail below is of the file being chosen, from
 * this device, before it is sent.
 *
 * 036 C14: the file input was never reset after adding (choosing the same file again did nothing),
 * and the hint promised that a signature could be replaced while the screen offered no way to do it.
 * Each row now has Edit (name, title, replace the image) and Deactivate/Activate.
 */
export function SignatoriesScreen() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Signatory | 'new' | null>(null);

  /**
   * No company segment any more (019 FR-005).
   *
   * The hazard this guarded against is real — react-query answering a switch from cache
   * shows the previous company's rows under the new company's name, the failure that looks
   * exactly like success. It is now handled once, centrally: the switcher clears the whole
   * cache, so no screen has to remember to key on a company it no longer knows.
   */
  const signatories = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getSignatories(),
  });

  const toggle = useMutation({
    mutationFn: (s: Signatory) =>
      upsertSignatory({ name: s.name, title: s.title, isActive: !s.isActive }, s.id),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(
        saved.isActive ? `${saved.name} activated.` : `${saved.name} deactivated.`,
      );
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, 'The signatory could not be changed.')),
  });

  const changeActive = async (s: Signatory) => {
    if (s.isActive) {
      const ok = await confirmDialog({
        title: `Deactivate ${s.name}?`,
        message:
          'They will no longer be offered when issuing a letter. Letters they already signed stay valid, and they can be activated again.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    toggle.mutate(s);
  };

  if (signatories.isError) {
    return (
      <QueryError
        error={signatories.error}
        onRetry={signatories.refetch}
        fallback="Signatories could not be loaded."
      />
    );
  }

  const columns: Column<Signatory>[] = [
    { key: 'name', header: 'Name', render: (s) => s.name },
    { key: 'title', header: 'Title', render: (s) => s.title },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs ${
            s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {s.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing('new')}>
          Add signatory
        </Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={signatories.data ?? []}
        rowKey={(s) => s.id}
        isLoading={signatories.isPending}
        emptyMessage="No signatories yet. A letter kind that carries a signature cannot be issued until one exists."
        actions={(s) => (
          <>
            <RowAction type="button" onClick={() => setEditing(s)}>
              Edit
            </RowAction>
            <RowAction
              type="button"
              loading={toggle.isPending && toggle.variables?.id === s.id}
              disabled={toggle.isPending}
              onClick={() => void changeActive(s)}
              className={s.isActive ? 'text-red-600' : undefined}
            >
              {s.isActive ? 'Deactivate' : 'Activate'}
            </RowAction>
          </>
        )}
      />

      {editing && (
        <SignatoryModal
          signatory={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Add a signatory, or edit one — including replacing the image. */
function SignatoryModal({
  signatory,
  onClose,
}: {
  signatory: Signatory | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(signatory?.name ?? '');
  const [title, setTitle] = useState(signatory?.title ?? '');
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDirty =
    name !== (signatory?.name ?? '') ||
    title !== (signatory?.title ?? '') ||
    file !== null;

  const save = useMutation({
    mutationFn: () =>
      upsertSignatory(
        {
          name: name.trim(),
          title: title.trim(),
          // Omitted when editing without a new file: the stored image is left as it is.
          ...(file ? { signature: file.base64, contentType: file.mimeType } : {}),
        },
        signatory?.id,
      ),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(signatory ? `${saved.name} saved.` : `${saved.name} added.`);
      onClose();
    },
    onError: (err: unknown) =>
      setError(errorMessage(err, 'The signatory could not be saved.')),
  });

  const submit = async () => {
    setError(null);
    if (!name.trim() || !title.trim()) {
      setError('Enter a name and a title.');
      return;
    }
    if (!signatory && !file) {
      setError('Choose a signature image.');
      return;
    }
    if (signatory && file) {
      const ok = await confirmDialog({
        title: 'Replace the signature?',
        message:
          'Letters issued from now on carry the new image. Letters already issued keep the signature applied at the time.',
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    save.mutate();
  };

  return (
    <Modal
      title={signatory ? `Edit ${signatory.name}` : 'Add a signatory'}
      onClose={onClose}
      isDirty={isDirty}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={save.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            loading={save.isPending}
            disabled={!isDirty}
            onClick={() => void submit()}
          >
            {signatory ? 'Save' : 'Add signatory'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormError message={error} />
        <TextField
          id="signatory-name"
          label="Name"
          aria-required="true"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          id="signatory-title"
          label="Title"
          aria-required="true"
          maxLength={120}
          hint="Printed beneath the signature."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FileUpload
          label={signatory ? 'Replace the signature image (optional)' : 'Signature image'}
          accept={SIGNATURE_ACCEPT}
          maxBytes={SIGNATURE_MAX_BYTES}
          compress={false}
          hint="PNG or JPEG, up to 2 MB. Replacing it changes what future letters carry; letters already issued keep the signature applied at the time."
          onSelect={setFile}
        />
      </form>
    </Modal>
  );
}
