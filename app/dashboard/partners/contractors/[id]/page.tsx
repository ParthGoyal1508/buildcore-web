'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  ContractorDocument,
  deleteContractorDocument,
  getContractor,
  uploadContractorDocument,
} from '@/app/lib/api/partners';
import {
  CONTRACTOR_DOCUMENT_TYPES,
  MESSAGES,
  ROUTES,
  partnersLabel,
} from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';

/** Reads a File as base64 without the `data:` prefix — the shape the API expects. */
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

export default function ContractorDetailPage() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id;
  const queryClient = useQueryClient();

  const [documentType, setDocumentType] = useState<string>(
    CONTRACTOR_DOCUMENT_TYPES[0],
  );
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'contractor', contractorId],
    queryFn: () => getContractor(contractorId),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file to upload.');
      return uploadContractorDocument(contractorId, {
        documentType,
        file: await toBase64(file),
        fileName: file.name,
        contentType: file.type || undefined,
        expiresAt: expiresAt || undefined,
      });
    },
    onSuccess: () => {
      setError(null);
      setFile(null);
      setExpiresAt('');
      queryClient.invalidateQueries({
        queryKey: ['partners', 'contractor', contractorId],
      });
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
    },
    onError: (err: unknown) =>
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : MESSAGES.saveFailed,
      ),
  });

  const removeDocument = useMutation({
    mutationFn: (documentId: string) => deleteContractorDocument(documentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['partners', 'contractor', contractorId],
      }),
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

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
          {row.fileName && <p className="text-xs text-gray-500">{row.fileName}</p>}
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
        row.expiresAt ? dateLabel(row.expiresAt) : <span className="text-gray-400">No expiry</span>,
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
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }

  return (
    <main>
      <div className="mb-6">
        <h1 className={`${lusitana.className} mb-1 text-2xl`}>
          {data.vendorName ?? 'Contractor'}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>{data.vendorCode}</span>
          <StatusBadge status={data.complianceStatus} />
          <Link
            href={`${ROUTES.partnersCompliance}?contractorId=${data.id}`}
            className="font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            View compliance history
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 font-medium text-gray-900">Registrations</h2>
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
              <dd className="text-gray-900">
                {value ?? <span className="text-gray-400">Not recorded</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 font-medium text-gray-900">Documents</h2>
        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <DataTable
          columns={columns}
          rows={data.documents ?? []}
          rowKey={(row) => row.id}
          emptyMessage="No documents uploaded yet."
          actions={(row) => (
            <button
              type="button"
              disabled={removeDocument.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete this ${partnersLabel(row.documentType).toLowerCase()}? The stored file is removed too.`,
                  )
                ) {
                  removeDocument.mutate(row.id);
                }
              }}
              className="text-sm font-medium text-red-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:text-gray-400"
            >
              Delete
            </button>
          )}
        />
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 font-medium text-gray-900">Upload a document</h2>
        <form
          className="grid gap-4 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            upload.mutate();
          }}
        >
          <Field id="doc-type" label="Document type">
            <SelectInput
              id="doc-type"
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
          <Field id="doc-file" label="File">
            <TextInput
              id="doc-file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={upload.isPending || !file}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
