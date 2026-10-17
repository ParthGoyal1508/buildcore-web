'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  ContractorDocument,
  deleteContractorDocument,
  getContractor,
  getContractorDocumentFile,
  uploadContractorDocument,
} from '@/app/lib/api/partners';
import {
  CONTRACTOR_DOCUMENT_TYPES,
  MESSAGES,
  ROUTES,
  partnersLabel,
} from '@/app/lib/constants';
import { openStoredFile } from '@/app/lib/download-file';
import { dateLabel } from '@/app/lib/format';
import { useCanWrite } from '@/app/lib/write-access';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import FileUpload from '@/app/ui/file-upload';
import ContractorRegistrationsModal from '@/app/ui/partners/contractor-registrations-modal';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import PageHeader from '@/app/ui/page-header';
import { PageSkeleton } from '@/app/ui/page-skeleton';
import QueryError from '@/app/ui/query-error';
import { confirmDialog } from '@/app/ui/dialogs';
import NocPanel from '@/app/ui/nocs/noc-panel';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/**
 * What a contractor document may be (036 N4, 2026-10-17): the API's allow-list — PDF, photos,
 * Word and Excel — so a file it would refuse with 415 is refused here before it is read.
 * HEIC is left out because the API cannot store it and most browsers cannot convert it.
 */
const DOCUMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx';

export default function ContractorDetailPage() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id;
  const queryClient = useQueryClient();

  const [documentType, setDocumentType] = useState<string>(
    CONTRACTOR_DOCUMENT_TYPES[0],
  );
  const [expiresAt, setExpiresAt] = useState('');
  const [editingRegistrations, setEditingRegistrations] = useState(false);
  // The document being fetched for View, so its button shows it is working.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const toast = useToast();
  const canWrite = useCanWrite();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['partners', 'contractor', contractorId],
    queryFn: () => getContractor(contractorId),
  });

  // Sent the moment a file is picked, with the type and expiry chosen above it. `FileUpload`
  // checks the type and size first and clears its input afterwards whatever happened, so the
  // same file can be picked again after a failure (036 N4).
  const uploadDocument = (file: { base64: string; fileName: string }) =>
    uploadContractorDocument(contractorId, {
      documentType,
      file: file.base64,
      fileName: file.fileName,
      expiresAt: expiresAt || undefined,
    });

  const onUploaded = () => {
    setExpiresAt('');
    toast.success(`${partnersLabel(documentType)} uploaded.`);
    queryClient.invalidateQueries({
      queryKey: ['partners', 'contractor', contractorId],
    });
    queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
  };

  const removeDocument = useMutation({
    mutationFn: (documentId: string) => deleteContractorDocument(documentId),
    onSuccess: () => {
      toast.success('Document deleted.');
      queryClient.invalidateQueries({
        queryKey: ['partners', 'contractor', contractorId],
      });
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, MESSAGES.saveFailed)),
  });

  // Opens a licence or certificate that could be uploaded but, before 036 N4, never seen again.
  async function viewDocument(row: ContractorDocument) {
    if (viewingId) return;
    setViewingId(row.id);
    try {
      const file = await getContractorDocumentFile(row.id);
      openStoredFile(file, row.fileName ?? partnersLabel(row.documentType));
    } catch (err) {
      toast.error(errorMessage(err, MESSAGES.loadFailed));
    } finally {
      setViewingId(null);
    }
  }

  const columns: Column<ContractorDocument>[] = [
    {
      key: 'type',
      header: 'Document',
      sticky: true,
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">
            {partnersLabel(row.documentType)}
          </p>
          {row.fileName && (
            <p className="text-xs text-gray-500">{row.fileName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'uploaded',
      header: 'Uploaded',
      render: (row) => dateLabel(row.uploadedAt),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) =>
        row.expiresAt ? (
          dateLabel(row.expiresAt)
        ) : (
          <span className="text-gray-400">No expiry</span>
        ),
    },
    {
      key: 'warning',
      header: 'Status',
      render: (row) => {
        if (!row.expiresAt) return <span className="text-gray-400">—</span>;
        if (!row.expiryWarning) return <StatusBadge status="active" />;
        // Past expiry is a different problem from imminent expiry, and the row
        // should say which — the API's single boolean does not distinguish them, so
        // the date does.
        const expired = new Date(row.expiresAt) < new Date();
        return <StatusBadge status={expired ? 'expired' : 'expiring_soon'} />;
      },
    },
  ];

  if (isPending) {
    return (
      <div role="status">
        <span className="sr-only">Loading…</span>
        <PageSkeleton />
      </div>
    );
  }
  if (error || !data) {
    return <QueryError error={error} onRetry={() => refetch()} />;
  }

  return (
    <main>
      <div className="mb-6">
        <PageHeader title={data.vendorName ?? 'Contractor'} className="mb-1" />
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>{data.vendorCode}</span>
          <StatusBadge status={data.complianceStatus} />
          <Link
            href={`${ROUTES.partnersCompliance}?contractorId=${data.id}`}
            className="font-medium text-brand-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            View compliance history
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-lg border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-medium text-gray-900">Registrations</h2>
          {canWrite && (
            <SecondaryButton
              type="button"
              onClick={() => setEditingRegistrations(true)}
            >
              Edit
            </SecondaryButton>
          )}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Labour licence', data.licenceNumber],
            ['PF registration', data.pfRegistration],
            ['ESIC registration', data.esicRegistration],
            ['BOCW registration', data.bocwRegistration],
            ['Insurance policy', data.insurancePolicyNumber],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="break-words text-gray-900">
                {value || <span className="text-gray-500">Not recorded</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The vendor's NOCs (2026-10-15), the same list the vendor register's "NOC" opens. */}
      <div className="mb-6">
        <NocPanel subjectType="vendor" subjectId={data.vendorId} />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 font-medium text-gray-900">Documents</h2>
        <DataTable
          columns={columns}
          rows={data.documents ?? []}
          rowKey={(row) => row.id}
          emptyMessage="No documents uploaded yet."
          actions={(row) => (
            <>
              <RowAction
                type="button"
                intent="read"
                loading={viewingId === row.id}
                disabled={viewingId !== null && viewingId !== row.id}
                onClick={() => viewDocument(row)}
              >
                View
              </RowAction>
              <RowAction
                type="button"
                loading={
                  removeDocument.isPending && removeDocument.variables === row.id
                }
                disabled={removeDocument.isPending}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Delete this document?',
                      message: `Delete this ${partnersLabel(row.documentType).toLowerCase()}? The stored file is removed too.`,
                      confirmLabel: 'Delete',
                      tone: 'danger',
                    })
                  ) {
                    removeDocument.mutate(row.id);
                  }
                }}
              >
                Delete
              </RowAction>
            </>
          )}
        />
      </section>

      {canWrite && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-1 font-medium text-gray-900">Upload a document</h2>
          <p className="mb-3 text-sm text-gray-600">
            Choose the type and expiry first — the file is uploaded as soon as it is picked.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="doc-type" label="Document type" required>
              <SelectInput
                id="doc-type"
                aria-required
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
              >
                {CONTRACTOR_DOCUMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {partnersLabel(value)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field
              id="doc-expiry"
              label="Expires on"
              hint="Optional. Drives the expiry warning."
            >
              <TextInput
                id="doc-expiry"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </Field>
            <FileUpload
              id="doc-file"
              label="File"
              accept={DOCUMENT_ACCEPT}
              hint="PDF, photo, Word or Excel, up to 10 MB."
              onUpload={uploadDocument}
              onUploaded={onUploaded}
            />
          </div>
        </section>
      )}

      {editingRegistrations && (
        <ContractorRegistrationsModal
          contractor={data}
          onClose={() => setEditingRegistrations(false)}
        />
      )}
    </main>
  );
}
