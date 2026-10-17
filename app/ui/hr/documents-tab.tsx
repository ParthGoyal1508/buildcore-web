'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  getEmployeeDocumentFile,
  listEmployeeDocuments,
  uploadEmployeeDocument,
  type EmployeeDocument,
} from '@/app/lib/api/hr-payroll';
import { listDocumentTypes, type DocumentType } from '@/app/lib/api/settings';
import { HR_MESSAGES } from '@/app/lib/constants';
import { formatBytes } from '@/app/lib/files';
import { dateLabel, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import StatusBadge from '@/app/ui/status-badge';

/** Warn this many days before an expiry, so there is time to act on it. */
const EXPIRY_WARNING_DAYS = 30;

function daysUntil(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
}

interface DocumentRow {
  type: DocumentType;
  document: EmployeeDocument | null;
}

/**
 * The Documents tab (005 US2).
 *
 * Rows come from the *document types configured for the company*, not from what has
 * been uploaded — otherwise a mandatory type nobody has uploaded yet would simply
 * not appear, which is exactly the case the mandatory-completion gate exists to
 * catch. Uploaded documents are matched onto those rows.
 *
 * 036 F14/F15: Upload and Replace open one dialog that asks for the file **and** the number and
 * expiry the type requires — the inline inputs disappeared once a document existed, so replacing
 * a passport or licence always got a 400. Every uploaded document can be opened (View), earlier
 * versions are kept and listed under History, and the file's name and size are shown.
 */
export default function DocumentsTab({ employeeId }: { employeeId: string }) {
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [history, setHistory] = useState<DocumentRow | null>(null);
  const { view, viewer } = useFileViewer();

  const typesQuery = useQuery({
    queryKey: ['documentTypes'],
    queryFn: () => listDocumentTypes(),
  });
  const documentsQuery = useQuery({
    queryKey: ['hr', 'employeeDocuments', employeeId],
    queryFn: () => listEmployeeDocuments(employeeId),
  });

  const uploaded = documentsQuery.data?.items ?? [];
  const rows: DocumentRow[] = (typesQuery.data ?? [])
    .filter((type) => type.isActive)
    .map((type) => ({
      type,
      document: uploaded.find((doc) => doc.documentTypeId === type.id) ?? null,
    }));

  const mandatory = rows.filter((row) => row.type.isMandatory);
  const mandatoryDone = mandatory.filter((row) => row.document).length;
  const percent = mandatory.length
    ? Math.round((mandatoryDone / mandatory.length) * 100)
    : 100;

  const openFile = (row: DocumentRow, versionId?: string, label?: string) => {
    if (!row.document) return;
    const documentId = row.document.id;
    void view({
      title: label ?? row.type.name,
      fileName: row.document.fileName ?? row.type.name,
      load: () => getEmployeeDocumentFile(employeeId, documentId, versionId),
    });
  };

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
      render: (row) => row.document?.documentNumber ?? '—',
    },
    {
      key: 'expiry',
      header: 'Expires',
      render: (row) => {
        const expiresAt = row.document?.expiresAt;
        if (!expiresAt) return '—';
        const days = daysUntil(expiresAt);
        const warn = days <= EXPIRY_WARNING_DAYS;
        return (
          <span className="inline-flex items-center gap-1.5">
            {dateLabel(expiresAt)}
            {warn && (
              <span role="status">
                <StatusBadge
                  tone="warning"
                  label={HR_MESSAGES.documentExpiringSoon(days)}
                  icon={ExclamationTriangleIcon}
                />
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'file',
      header: 'File',
      render: (row) =>
        row.document ? (
          <span className="block max-w-[14rem] truncate text-gray-700">
            {row.document.fileName ?? 'Uploaded file'}
            {row.document.sizeBytes ? (
              <span className="ml-1 text-xs text-gray-500">
                {formatBytes(row.document.sizeBytes)}
              </span>
            ) : null}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'uploaded',
      header: 'Uploaded',
      render: (row) =>
        row.document ? dateLabel(row.document.uploadedAt) : 'Not uploaded',
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

      <DataTable
        caption="Employee documents"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.type.id}
        isLoading={typesQuery.isPending || documentsQuery.isPending}
        error={typesQuery.error ?? documentsQuery.error ?? null}
        onRetry={() => {
          void typesQuery.refetch();
          void documentsQuery.refetch();
        }}
        emptyMessage="No document types are configured for this company yet."
        actions={(row) => (
          <>
            {row.document && (
              <RowAction intent="read" type="button" onClick={() => openFile(row)}>
                View
              </RowAction>
            )}
            {(row.document?.previousVersions?.length ?? 0) > 0 && (
              <RowAction intent="read" type="button" onClick={() => setHistory(row)}>
                History ({row.document!.previousVersions!.length})
              </RowAction>
            )}
            <RowAction type="button" onClick={() => setEditing(row)}>
              {row.document ? 'Replace' : 'Upload'}
            </RowAction>
          </>
        )}
      />

      {editing && (
        <UploadDocumentModal
          employeeId={employeeId}
          row={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {history?.document && (
        <Modal title={`${history.type.name}: earlier versions`} onClose={() => setHistory(null)} wide>
          <ul className="divide-y divide-gray-100 text-sm">
            {(history.document.previousVersions ?? []).map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-gray-900">
                    {version.fileName ?? 'Uploaded file'}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {version.documentNumber ? `No. ${version.documentNumber} · ` : ''}
                    {version.expiresAt ? `expires ${dateLabel(version.expiresAt)} · ` : ''}
                    uploaded {dateLabel(version.uploadedAt)}, replaced{' '}
                    {dateLabel(version.replacedAt)}
                  </span>
                </span>
                <RowAction
                  intent="read"
                  type="button"
                  onClick={() =>
                    openFile(
                      history,
                      version.id,
                      `${history.type.name} (replaced ${dateLabel(version.replacedAt)})`,
                    )
                  }
                >
                  View
                </RowAction>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {viewer}
    </div>
  );
}

/**
 * Upload or replace one document (036 F14). Asks for what the type requires — the number and the
 * expiry — every time, because a renewed passport has a new number and a new expiry; the previous
 * number is shown as a hint. A failed save keeps everything entered.
 */
function UploadDocumentModal({
  employeeId,
  row,
  onClose,
}: {
  employeeId: string;
  row: DocumentRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const replacing = Boolean(row.document);
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      uploadEmployeeDocument(employeeId, {
        documentTypeId: row.type.id,
        file: file!.base64,
        contentType: file!.mimeType,
        fileName: file!.fileName,
        documentNumber: documentNumber.trim() || undefined,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: (saved) => {
      // A restricted type (Aadhaar) keeps no earlier copy (017 FR-006a), so the message follows
      // what the server actually kept rather than promising it.
      const kept =
        (saved.previousVersions?.length ?? 0) >
        (row.document?.previousVersions?.length ?? 0);
      toast.success(
        !replacing
          ? `${row.type.name} uploaded.`
          : kept
            ? `${row.type.name} replaced. The previous file is kept under History.`
            : `${row.type.name} replaced.`,
      );
      queryClient.invalidateQueries({ queryKey: ['hr', 'employeeDocuments', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err, 'Could not upload the document.')),
  });

  const missing =
    !file ||
    (row.type.needsNumber && !documentNumber.trim()) ||
    (row.type.hasExpiry && !expiresAt);

  return (
    <Modal
      title={`${replacing ? 'Replace' : 'Upload'} ${row.type.name}`}
      onClose={onClose}
      isDirty={Boolean(file || documentNumber || expiresAt)}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={save.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            disabled={Boolean(missing)}
            loading={save.isPending}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {replacing ? 'Replace' : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <FileUpload label="File (required)" onSelect={setFile} disabled={save.isPending} />
        {row.type.needsNumber && (
          <TextField
            id="document-number"
            label="Document number (required)"
            value={documentNumber}
            maxLength={100}
            required
            onChange={(event) => setDocumentNumber(event.target.value)}
            hint={
              row.document?.documentNumber
                ? `Currently on file: ${row.document.documentNumber}`
                : undefined
            }
          />
        )}
        {row.type.hasExpiry && (
          <TextField
            id="document-expiry"
            label="Expiry date (required)"
            type="date"
            value={expiresAt}
            min={replacing ? todayIso() : undefined}
            required
            onChange={(event) => setExpiresAt(event.target.value)}
            hint={
              row.document?.expiresAt
                ? `The current one expires ${dateLabel(row.document.expiresAt)}.`
                : undefined
            }
          />
        )}
        {replacing && (
          <p className="text-xs text-gray-500">
            The current file is kept as an earlier version (except restricted documents such as
            Aadhaar, whose old copies are not retained).
          </p>
        )}
      </div>
    </Modal>
  );
}
