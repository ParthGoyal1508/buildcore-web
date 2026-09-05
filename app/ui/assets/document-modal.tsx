'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { uploadAssetDocument } from '@/app/lib/api/assets';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useAssetDocTypes } from './use-asset-refs';

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
 * Attach a document to an asset (spec FR-022).
 *
 * A failed upload leaves the asset exactly as it was — this is a separate request
 * against an asset that already exists, never part of registering one. That is why
 * the control lives on the detail screen rather than in the registration form: an
 * upload that failed halfway through a registration would either lose the asset or
 * leave one with a document nobody can find.
 *
 * The type list comes from the Doc Types master rather than a hardcoded array: each
 * type carries its own alert window, and the expiry marker is computed from it.
 */
export default function AssetDocumentModal({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const docTypes = useAssetDocTypes();

  const [docTypeId, setDocTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = docTypes.data?.find((type) => type.id === docTypeId);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.');
      return uploadAssetDocument(assetId, {
        docTypeId,
        file: await toBase64(file),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        ...(documentNumber.trim()
          ? { documentNumber: documentNumber.trim() }
          : {}),
        ...(issueDate ? { issueDate } : {}),
        ...(expiryDate ? { expiryDate } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : MESSAGES.saveFailed,
      ),
  });

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
            form="asset-document-form"
            disabled={upload.isPending || !docTypeId || !file}
          >
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <form
        id="asset-document-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          upload.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />

        <SelectField
          id="asset-document-type"
          label="Document type"
          value={docTypeId}
          onChange={(event) => setDocTypeId(event.target.value)}
          required
          hint={
            selected
              ? `Starts flagging ${selected.alertDays} days before it expires.`
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
            htmlFor="asset-document-file"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            File
          </label>
          <input
            id="asset-document-file"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="mt-1 text-xs text-gray-500">
            PDF or image, up to 10MB.
          </p>
        </div>

        <TextField
          id="asset-document-number"
          label="Document number"
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          maxLength={80}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="asset-document-issued"
            label="Issued on"
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
          <TextField
            id="asset-document-expiry"
            label="Expires on"
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
            hint="Leave empty for a document that does not lapse."
          />
        </div>
      </form>
    </Modal>
  );
}
