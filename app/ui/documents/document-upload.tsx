'use client';

import { useMemo, useState } from 'react';

import { DOCUMENT_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { FormError, SelectField, TextField } from '@/app/ui/settings/form-fields';

/** One kind this owner may upload against, WITH its label — from the server. */
export interface UploadKind {
  documentTypeId: string;
  name: string;
  /** Drives the required expiry field. */
  expires: boolean;
  isRestricted?: boolean;
}

export interface DocumentUploadInput {
  documentTypeId: string;
  data: string;
  contentType: string;
  /** The uploader's own file name, so the download is what they recognise. */
  fileName: string;
  documentNumber?: string;
  expiresAt?: string;
}

interface DocumentUploadProps {
  /**
   * **A prop, not an import.** The required set is company configuration; two companies
   * may differ, and FR-011 lets new kinds appear without a release. A client-side list
   * would be wrong the first time somebody added one.
   */
  kinds: UploadKind[];
  onUpload: (input: DocumentUploadInput) => Promise<unknown>;
  /** "this company" / "this project" — used in prompts, and no module identity beyond. */
  ownerLabel: string;
  /** Preselect a kind, when the control is opened from a specific missing row. */
  initialDocumentTypeId?: string;
  onDone?: () => void;
}

/** Reads a File as base64, the transport 015 established for every upload here. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // `data:application/pdf;base64,XXXX` — the payload is after the comma.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploading a document, shared by the company and project screens (017 US1, US2).
 *
 * One component for both on purpose: two upload experiences is the failure this exists
 * to prevent, and a project screen that asked for an expiry differently from the company
 * screen would teach people that the rules depend on where they are standing.
 *
 * **The expiry field becomes required in the form when the selected kind expires.** The
 * server refuses it with `DOCUMENT_EXPIRY_REQUIRED` regardless, but asking first means
 * nobody is told off for something the form could have requested — the same reasoning as
 * 016's mandatory reason box for reject and return.
 */
export function DocumentUpload({
  kinds,
  onUpload,
  ownerLabel,
  initialDocumentTypeId,
  onDone,
}: DocumentUploadProps) {
  const [documentTypeId, setDocumentTypeId] = useState(
    initialDocumentTypeId ?? kinds[0]?.documentTypeId ?? '',
  );
  const [file, setFile] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => kinds.find((k) => k.documentTypeId === documentTypeId) ?? null,
    [kinds, documentTypeId],
  );
  const expiryRequired = selected?.expires ?? false;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (expiryRequired && !expiresAt) {
      setError(DOCUMENT_COPY.expiryRequired);
      return;
    }

    setBusy(true);
    try {
      await onUpload({
        documentTypeId,
        data: await readAsBase64(file),
        contentType: file.type || 'application/octet-stream',
        fileName: file.name,
        documentNumber: documentNumber.trim() || undefined,
        expiresAt: expiresAt || undefined,
      });
      setFile(null);
      setDocumentNumber('');
      setExpiresAt('');
      onDone?.();
    } catch (err) {
      // The error's own message only when it carries a `code` — 016 shipped a control
      // that showed "Internal Server Error" to somebody who had just typed a paragraph.
      const code = (err as { code?: string } | null)?.code;
      setError(
        code && err instanceof Error ? err.message : DOCUMENT_COPY.uploadFailed,
      );
    } finally {
      setBusy(false);
    }
  };

  if (kinds.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No document kinds are defined for {ownerLabel} yet.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SelectField
        id="document-kind"
        label="Document"
        value={documentTypeId}
        onChange={(e) => setDocumentTypeId(e.target.value)}
      >
        {kinds.map((kind) => (
          <option key={kind.documentTypeId} value={kind.documentTypeId}>
            {kind.name}
          </option>
        ))}
      </SelectField>

      <div>
        <label
          htmlFor="document-file"
          className="mb-1 block text-sm font-medium text-gray-900"
        >
          File
        </label>
        <input
          id="document-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
        />
      </div>

      <TextField
        id="document-number"
        label="Document number"
        hint="The number printed on it — GSTIN, PAN, licence number."
        value={documentNumber}
        onChange={(e) => setDocumentNumber(e.target.value)}
      />

      <TextField
        id="document-expiry"
        type="date"
        label={expiryRequired ? 'Expiry date (required)' : 'Expiry date'}
        hint={expiryRequired ? DOCUMENT_COPY.expiryRequired : undefined}
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />

      <FormError message={error} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
        <p className="text-xs text-gray-500">{DOCUMENT_COPY.supersedeHint}</p>
      </div>
    </form>
  );
}
