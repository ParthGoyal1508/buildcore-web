'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { uploadEquipmentDocument } from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { MAX_UPLOAD_BYTES } from '@/app/lib/files';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { usePlantDocTypes } from './use-plant-refs';

/** Strips the `data:...;base64,` prefix a FileReader result carries. */
export function toBase64(file: File): Promise<string> {
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
 * What a machine's document may be — the API's document allow-list (036 K13): PDF, the three
 * photo formats, and Excel/Word. The server checks the file's own bytes and refuses anything else
 * (415), so this is the same list said early.
 */
export const EQUIPMENT_DOCUMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp,' +
  '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Attach a document to a machine.
 *
 * The type list comes from the Doc Types master rather than a hardcoded array
 * (web FR-008): each type carries its own alert window, and the register's expiry
 * badge is computed from it. A hardcoded list here would offer types the backend
 * has never heard of.
 *
 * 036 K13: the file goes through `FileUpload` — the accepted types and the 10 MB limit are checked
 * before anything is read, a photographed paper is shrunk, and an image shows a preview.
 */
export default function DocumentModal({
  equipmentId,
  onClose,
}: {
  equipmentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const docTypes = usePlantDocTypes();

  const [docTypeId, setDocTypeId] = useState('');
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = docTypes.data?.find((type) => type.id === docTypeId);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first.');
      return uploadEquipmentDocument(equipmentId, {
        docTypeId,
        file: file.base64,
        fileName: file.fileName,
        contentType: file.mimeType || 'application/octet-stream',
        ...(expiresAt ? { expiresAt } : {}),
      });
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success(`${document.docTypeName} attached.`);
      onClose();
    },
    onError: (err) => setError(errorMessage(err, MESSAGES.plantSaveFailed)),
  });

  const noDocTypes = docTypes.data?.length === 0;

  return (
    <Modal
      title="Attach a document"
      onClose={onClose}
      isDirty={Boolean(file || docTypeId || expiresAt)}
      pending={upload.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="document-form"
            loading={upload.isPending}
            disabled={!file || !docTypeId || noDocTypes}
          >
            Upload
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

        <FileUpload
          id="document-file"
          label="File"
          accept={EQUIPMENT_DOCUMENT_ACCEPT}
          maxBytes={MAX_UPLOAD_BYTES}
          hint="PDF, JPEG, PNG, WebP, Excel or Word, up to 10 MB."
          onSelect={setFile}
        />

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
