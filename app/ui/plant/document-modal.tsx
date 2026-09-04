'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { uploadEquipmentDocument } from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { usePlantDocTypes } from './use-plant-refs';

/** Strips the `data:...;base64,` prefix a FileReader result carries. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Attach a document to a machine.
 *
 * The type list comes from the Doc Types master rather than a hardcoded array
 * (web FR-008): each type carries its own alert window, and the register's expiry
 * badge is computed from it. A hardcoded list here would offer types the backend
 * has never heard of.
 */
export default function DocumentModal({
  equipmentId,
  onClose,
}: {
  equipmentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const docTypes = usePlantDocTypes();

  const [docTypeId, setDocTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = docTypes.data?.find((type) => type.id === docTypeId);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.');
      return uploadEquipmentDocument(equipmentId, {
        docTypeId,
        file: await toBase64(file),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        ...(expiresAt ? { expiresAt } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : (err as Error).message,
      ),
  });

  const noDocTypes = docTypes.data?.length === 0;

  return (
    <Modal
      title="Attach a document"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="document-form"
            disabled={upload.isPending || !file || !docTypeId || noDocTypes}
          >
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <form
        id="document-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          upload.mutate();
        }}
      >
        <FormError message={error} />
        {noDocTypes && <FormError message={MESSAGES.plantNoDocTypes} />}

        <SelectField
          id="document-type"
          label="Document type"
          required
          value={docTypeId}
          onChange={(event) => setDocTypeId(event.target.value)}
          hint={
            selected
              ? `Flagged on the register ${selected.alertDays} days before it lapses.`
              : undefined
          }
        >
          <option value="">Select a type</option>
          {(docTypes.data ?? []).map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectField>

        <div>
          <label
            htmlFor="document-file"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            File
          </label>
          <input
            id="document-file"
            type="file"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-md border border-gray-200 p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
        </div>

        <TextField
          id="document-expiry"
          label="Expires on"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          hint="Leave blank for a document that does not expire — it then never raises an alert."
        />
      </form>
    </Modal>
  );
}
