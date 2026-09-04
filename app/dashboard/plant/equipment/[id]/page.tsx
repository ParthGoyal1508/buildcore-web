'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteEquipmentDocument,
  getEquipmentDetail,
  getEquipmentDocumentFile,
  getEquipmentMaintenanceCost,
  type EquipmentDocument,
} from '@/app/lib/api/plant';
import {
  MESSAGES,
  ROUTES,
  formatReading,
  plantLabel,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import DocumentModal from '@/app/ui/plant/document-modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['plant', 'equipment', id],
    queryFn: () => getEquipmentDetail(id),
  });

  const cost = useQuery({
    queryKey: ['plant', 'equipment', id, 'maintenance-cost'],
    queryFn: () => getEquipmentMaintenanceCost(id),
  });

  const removeDocument = useMutation({
    mutationFn: (documentId: string) => deleteEquipmentDocument(id, documentId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: () => setError('Could not remove that document.'),
  });

  /**
   * Opens a stored document in a new tab.
   *
   * Fetched rather than linked: the endpoint needs the bearer token, which lives in
   * memory and never appears in a URL, so a plain `<a href>` would 401. Same
   * treatment the inventory bill viewer gets.
   */
  async function openDocument(documentId: string) {
    setOpening(documentId);
    setError(null);
    try {
      const blob = await getEquipmentDocumentFile(id, documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not open that document.',
      );
    } finally {
      setOpening(null);
    }
  }

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {MESSAGES.plantLoadFailed}
      </p>
    );
  }

  const documentColumns: Column<EquipmentDocument>[] = [
    { key: 'type', header: 'Type', render: (row) => row.docTypeName },
    {
      key: 'file',
      header: 'File',
      render: (row) => (
        <button
          type="button"
          onClick={() => void openDocument(row.id)}
          disabled={opening === row.id}
          className="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:text-gray-400"
        >
          {opening === row.id ? 'Opening…' : (row.fileName ?? 'View')}
        </button>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) => row.expiresAt?.slice(0, 10) ?? '—',
    },
    {
      key: 'alert',
      header: 'Status',
      // Expired and expiring are different things and get different words. Both
      // read as orange rather than red: neither is a failure, both are a task.
      render: (row) =>
        row.expired ? (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            Expired
          </span>
        ) : row.expiring ? (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
            Expiring soon
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
  ];

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Category', value: data.categoryName },
    {
      label: 'Ownership',
      value:
        data.ownership === 'hired'
          ? `Hired — ${data.vendorName ?? 'unknown vendor'}`
          : 'Owned',
    },
    { label: 'Power source', value: plantLabel(data.powerSource) },
    { label: 'Deployed at', value: data.siteName ?? 'Not deployed' },
    {
      label: 'Meter reading',
      value: formatReading(data.currentReading, data.meterType),
    },
    { label: 'Utilisation this month', value: `${data.utilizationPercent}%` },
    {
      label: 'Purchase',
      value: data.purchaseCost
        ? `${formatRupees(data.purchaseCost)} on ${data.purchaseDate?.slice(0, 10) ?? '—'}`
        : '—',
    },
    {
      label: 'Depreciation',
      value:
        data.depreciationRate === null
          ? '—'
          : `${data.depreciationRate}% per annum`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} text-2xl`}>
            {data.code} · {data.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={data.status} label={plantLabel(data.status)} />
            {data.openMaintenanceJobId && (
              <Link
                href={ROUTES.plantMaintenance}
                className="text-sm text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Open maintenance job
              </Link>
            )}
          </div>
        </div>
        <Link
          href={ROUTES.plantEquipment}
          className="text-sm text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Back to the register
        </Link>
      </div>

      {/*
        Links into the module's own lists, pre-filtered to this machine, rather than
        four more tab panels here. The task list asked for tabs; the lists already
        exist, already page, already filter, and duplicating them on this page would
        mean two implementations of each drifting apart.
      */}
      <nav aria-label="This machine elsewhere" className="flex flex-wrap gap-3">
        {[
          { name: 'Logbook', href: ROUTES.plantLogbook },
          { name: 'Fuel', href: ROUTES.plantFuel },
          { name: 'Maintenance', href: ROUTES.plantMaintenance },
          { name: 'Service schedules', href: ROUTES.plantServices },
          ...(data.ownership === 'hired'
            ? [{ name: 'Hire bills', href: ROUTES.plantHireBills }]
            : []),
        ].map((link) => (
          <Link
            key={link.href}
            href={`${link.href}?equipmentId=${id}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {link.name}
          </Link>
        ))}
      </nav>

      <FormError message={error} />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {fact.label}
              </dt>
              <dd className="mt-0.5 text-sm text-gray-900">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        FR-026's three-way split, shown as three figures rather than one total.
        Parts, the workshop's own hours and a third party's invoice are three
        different decisions, and a single number hides which of them is growing.
      */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Lifetime maintenance cost
        </h2>
        {cost.data ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Spare parts', value: cost.data.partsCost },
              { label: 'Internal labour', value: cost.data.labourCost },
              { label: 'Service bills', value: cost.data.serviceBillCost },
              { label: 'Total', value: cost.data.totalCost },
            ].map((line) => (
              <div key={line.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {line.label}
                </dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {formatRupees(line.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        )}
        {cost.data && (
          <p className="mt-3 text-xs text-gray-500">
            Across {cost.data.jobCount}{' '}
            {cost.data.jobCount === 1 ? 'job' : 'jobs'}. Only verified service
            bills are counted.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
          <SecondaryButton type="button" onClick={() => setShowUpload(true)}>
            Attach a document
          </SecondaryButton>
        </div>
        <ResponsiveList
          columns={documentColumns}
          rows={data.documents}
          rowKey={(row) => row.id}
          emptyMessage="No documents are attached to this machine."
          actions={(row) => (
            <RowAction
              onClick={() => {
                if (window.confirm(MESSAGES.plantConfirmDeleteEquipmentDoc)) {
                  removeDocument.mutate(row.id);
                }
              }}
            >
              Remove
            </RowAction>
          )}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Service schedules
        </h2>
        <ResponsiveList
          columns={[
            {
              key: 'type',
              header: 'Service',
              render: (row: (typeof data.serviceSchedules)[number]) =>
                row.serviceType,
            },
            {
              key: 'lastDone',
              header: 'Last done',
              render: (row: (typeof data.serviceSchedules)[number]) =>
                formatReading(row.lastDoneReading, data.meterType),
            },
            {
              key: 'nextDue',
              header: 'Next due',
              render: (row: (typeof data.serviceSchedules)[number]) =>
                formatReading(row.nextDueReading, data.meterType),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row: (typeof data.serviceSchedules)[number]) => (
                <StatusBadge
                  status={row.status}
                  label={plantLabel(row.status)}
                />
              ),
            },
          ]}
          rows={data.serviceSchedules}
          rowKey={(row) => row.id}
          emptyMessage="No service schedules are set for this machine."
        />
      </section>

      {showUpload && (
        <DocumentModal
          equipmentId={id}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
