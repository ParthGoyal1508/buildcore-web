'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { uploadAssetDocument } from '@/app/lib/api/assets';
import { MESSAGES } from '@/app/lib/constants';
import { MAX_UPLOAD_BYTES } from '@/app/lib/files';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import { EQUIPMENT_DOCUMENT_ACCEPT } from '@/app/ui/plant/document-modal';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import { useAssetDocTypes } from './use-asset-refs';

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
 *
 * 036 L3: the file goes through `FileUpload`. The form said "up to 10MB" while about 7.5 MB was
 * the real limit (base64 inside a 10 MB body); the API now takes a real 10 MB file, checks its
 * type by its bytes, and this checks the type and size before reading anything.
 */
export default function AssetDocumentModal({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const docTypes = useAssetDocTypes();

  const [docTypeId, setDocTypeId] = useState('');
  const [file, setFile] = useState<PreparedFile | null>(null);
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
        file: file.base64,
        fileName: file.fileName,
        contentType: file.mimeType || 'application/octet-stream',
        ...(documentNumber.trim()
          ? { documentNumber: documentNumber.trim() }
          : {}),
        ...(issueDate ? { issueDate } : {}),
        ...(expiryDate ? { expiryDate } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Document attached.');
      onClose();
    },
    onError: (err) => setError(errorMessage(err, MESSAGES.saveFailed)),
  });

  return (
    <Modal
      title="Attach a document"
      onClose={onClose}
      isDirty={Boolean(file || docTypeId || documentNumber || expiryDate)}
      pending={upload.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="asset-document-form"
            loading={upload.isPending}
            disabled={!docTypeId || !file}
          >
            Upload
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

        <FileUpload
          id="asset-document-file"
          label="File"
          accept={EQUIPMENT_DOCUMENT_ACCEPT}
          maxBytes={MAX_UPLOAD_BYTES}
          hint="PDF, JPEG, PNG, WebP, Excel or Word, up to 10 MB."
          onSelect={setFile}
        />

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
            min={issueDate || undefined}
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
            hint="Leave empty for a document that does not lapse."
          />
        </div>
      </form>
    </Modal>
  );
}
