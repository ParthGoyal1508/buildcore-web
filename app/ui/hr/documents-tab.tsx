'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  listEmployeeDocuments,
  uploadEmployeeDocument,
} from '@/app/lib/api/hr-payroll';
import { listDocumentTypes, type DocumentType } from '@/app/lib/api/settings';
import { HR_MESSAGES, MESSAGES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { RowAction } from '@/app/ui/settings/form-fields';

/** Warn this many days before an expiry, so there is time to act on it. */
const EXPIRY_WARNING_DAYS = 30;

function daysUntil(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Reads a file as the base64 payload the upload endpoint expects.
 *
 * `readAsDataURL` yields `data:<mime>;base64,<payload>`; the backend wants the
 * payload alone and takes the content type as its own field.
 */
function readAsBase64(file: File): Promise<string> {
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

interface DocumentRow {
  type: DocumentType;
  documentId: string | null;
  documentNumber: string | null;
  expiresAt: string | null;
  uploadedAt: string | null;
}

/**
 * The Documents tab (005 US2).
 *
 * Rows come from the *document types configured for the company*, not from what has
 * been uploaded — otherwise a mandatory type nobody has uploaded yet would simply
 * not appear, which is exactly the case the mandatory-completion gate exists to
 * catch. Uploaded documents are matched onto those rows.
 */
export default function DocumentsTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});

  const { data: types, isLoading: typesLoading } = useQuery({
    queryKey: ['documentTypes'],
    queryFn: () => listDocumentTypes(),
  });

  const {
    data: documents,
    isLoading: docsLoading,
    isError,
  } = useQuery({
    queryKey: ['hr', 'employeeDocuments', employeeId],
    queryFn: () => listEmployeeDocuments(employeeId),
  });

  const upload = useMutation({
    mutationFn: async ({ type, file }: { type: DocumentType; file: File }) => {
      const payload = await readAsBase64(file);
      return uploadEmployeeDocument(employeeId, {
        documentTypeId: type.id,
        file: payload,
        contentType: file.type || 'application/octet-stream',
        documentNumber: numbers[type.id] || undefined,
        expiresAt: expiries[type.id] || undefined,
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({
        queryKey: ['hr', 'employeeDocuments', employeeId],
      });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setUploadingFor(null),
  });

  const uploaded = documents?.items ?? [];
  const rows: DocumentRow[] = (types ?? [])
    .filter((type) => type.isActive)
    .map((type) => {
      const match = uploaded.find((doc) => doc.documentTypeId === type.id);
      return {
        type,
        documentId: match?.id ?? null,
        documentNumber: match?.documentNumber ?? null,
        expiresAt: match?.expiresAt ?? null,
        uploadedAt: match?.uploadedAt ?? null,
      };
    });

  const mandatory = rows.filter((row) => row.type.isMandatory);
  const mandatoryDone = mandatory.filter((row) => row.documentId).length;
  const percent = mandatory.length
    ? Math.round((mandatoryDone / mandatory.length) * 100)
    : 100;

  const columns: Column<DocumentRow>[] = [
    {
      key: 'name',
      header: 'Document',
      sticky: true,
      render: (row) => (
        <span className="font-medium">
          {row.type.name}
          {row.type.isMandatory && (
            <span className="ml-1 text-red-600" aria-label="Mandatory">
              *
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'flag',
      header: 'Requires',
      render: (row) => <span className="text-gray-600">{row.type.flag}</span>,
    },
    {
      key: 'number',
      header: 'Number',
      render: (row) =>
        row.documentId ? (
          (row.documentNumber ?? '—')
        ) : row.type.needsNumber ? (
          <input
            type="text"
            aria-label={`${row.type.name} number`}
            value={numbers[row.type.id] ?? ''}
            onChange={(event) =>
              setNumbers((current) => ({
                ...current,
                [row.type.id]: event.target.value,
              }))
            }
            className="w-40 rounded-md border border-gray-200 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'expiry',
      header: 'Expires',
      render: (row) => {
        if (!row.documentId) {
          return row.type.hasExpiry ? (
            <input
              type="date"
              aria-label={`${row.type.name} expiry date`}
              value={expiries[row.type.id] ?? ''}
              onChange={(event) =>
                setExpiries((current) => ({
                  ...current,
                  [row.type.id]: event.target.value,
                }))
              }
              className="rounded-md border border-gray-200 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            />
          ) : (
            '—'
          );
        }
        if (!row.expiresAt) return '—';
        const days = daysUntil(row.expiresAt);
        const warn = days <= EXPIRY_WARNING_DAYS;
        return (
          <span className="inline-flex items-center gap-1.5">
            {dateLabel(row.expiresAt)}
            {warn && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                role="status"
              >
                <ExclamationTriangleIcon className="w-3.5" aria-hidden="true" />
                {HR_MESSAGES.documentExpiringSoon(days)}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'uploaded',
      header: 'Uploaded',
      render: (row) => (row.documentId ? dateLabel(row.uploadedAt) : 'Not uploaded'),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900">
            {HR_MESSAGES.documentsProgress(mandatoryDone, mandatory.length)}
          </span>
          <span className="tabular-nums text-gray-600">{percent}%</span>
        </div>
        {/* The width is genuinely computed from data and cannot be a Tailwind class
            — the one narrow exception Constitution Principle II allows, isolated to
            this single line. */}
        <div
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Mandatory document completion"
        >
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        {mandatoryDone < mandatory.length && (
          <p className="mt-1.5 text-xs text-gray-600">
            Attendance cannot be marked for this employee until every mandatory
            document is on file.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <DataTable
        caption="Employee documents"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.type.id}
        isLoading={typesLoading || docsLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No document types are configured for this company yet."
        actions={(row) => (
          <label className="cursor-pointer">
            <RowAction
              type="button"
              // The visible control is the label; the input itself is offscreen but
              // focusable, so this stays keyboard-reachable rather than being a
              // click-only affordance.
              tabIndex={-1}
              aria-hidden="true"
              disabled={uploadingFor === row.type.id}
            >
              {uploadingFor === row.type.id
                ? 'Uploading…'
                : row.documentId
                  ? 'Replace'
                  : 'Upload'}
            </RowAction>
            <input
              type="file"
              className="sr-only"
              aria-label={`${row.documentId ? 'Replace' : 'Upload'} ${row.type.name}`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploadingFor(row.type.id);
                upload.mutate({ type: row.type, file });
                event.target.value = '';
              }}
            />
          </label>
        )}
      />
    </div>
  );
}
