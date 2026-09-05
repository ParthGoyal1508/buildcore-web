'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  deleteAsset,
  getAllocations,
  getAsset,
  getAssetDocumentFile,
  type Allocation,
  type AssetDocument,
} from '@/app/lib/api/assets';
import { ApiError } from '@/app/lib/api/client';
import {
  MESSAGES,
  ROUTES,
  assetsLabel,
  formatAssetQuantity,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import AllocateModal from '@/app/ui/assets/allocate-modal';
import AssetModal from '@/app/ui/assets/asset-modal';
import AssetDocumentModal from '@/app/ui/assets/document-modal';
import ReturnModal from '@/app/ui/assets/return-modal';
import { lusitana } from '@/app/ui/fonts';
import {
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

type Tab = 'documents' | 'allocations' | 'stock';

/**
 * One asset, with everything hanging off it.
 *
 * Three tabs today — Documents, Allocations and Stock. The spec's Transfers,
 * Inspections and Repairs tabs belong to user stories that have not been built yet
 * (012 web Phases 6 and 7); adding empty tabs for them would promise screens that do
 * not exist.
 */
export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = params.id;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('documents');
  const [showEdit, setShowEdit] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [returning, setReturning] = useState<Allocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const asset = useQuery({
    queryKey: ['assets', 'register', 'detail', assetId],
    queryFn: () => getAsset(assetId),
  });

  const allocations = useQuery({
    queryKey: ['assets', 'allocations', 'for-asset', assetId],
    queryFn: () => getAllocations({ assetId, pageSize: 100 }),
    select: (page) => page.items,
  });

  const remove = useMutation({
    mutationFn: () => deleteAsset(assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      window.location.assign(ROUTES.assetsRegister);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  /**
   * Opens a stored document in a new tab.
   *
   * Fetched rather than linked: the endpoint needs the bearer token, which lives in
   * memory and never appears in a URL, so a plain `<a href>` would 401. The object
   * URL is revoked on a timer rather than immediately — revoking it before the new
   * tab has read it is a race the tab loses.
   */
  async function openDocument(documentId: string) {
    setError(null);
    try {
      const blob = await getAssetDocumentFile(assetId, documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not open this document.',
      );
    }
  }

  if (asset.isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (asset.isError || !asset.data) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {MESSAGES.assetsLoadFailed}
      </p>
    );
  }

  const row = asset.data;
  const openAllocation = (allocations.data ?? []).find(
    (entry) => entry.status === 'open',
  );

  const documentColumns: Column<AssetDocument>[] = [
    { key: 'type', header: 'Type', render: (doc) => doc.docTypeName },
    {
      key: 'number',
      header: 'Number',
      render: (doc) => doc.documentNumber ?? '—',
    },
    {
      key: 'expiry',
      header: 'Expires',
      render: (doc) =>
        doc.expiryDate ? (
          <span
            className={
              doc.expired
                ? 'text-red-700'
                : doc.expiring
                  ? 'text-orange-700'
                  : undefined
            }
          >
            {doc.expiryDate.slice(0, 10)}
            {doc.expired ? ' — expired' : doc.expiring ? ' — expiring' : ''}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'uploaded',
      header: 'Uploaded',
      hideOnCard: true,
      render: (doc) => doc.uploadedAt.slice(0, 10),
    },
  ];

  const allocationColumns: Column<Allocation>[] = [
    { key: 'site', header: 'Site', render: (entry) => entry.siteName },
    {
      key: 'custodian',
      header: 'Custodian',
      render: (entry) => entry.custodianName ?? '—',
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (entry) => formatAssetQuantity(entry.quantity, row.unitOfMeasure),
    },
    {
      key: 'from',
      header: 'From',
      render: (entry) => entry.allocatedFrom.slice(0, 10),
    },
    {
      key: 'due',
      header: 'Due back',
      render: (entry) => (
        <span className={entry.overdue ? 'text-red-700' : undefined}>
          {entry.expectedReturnDate.slice(0, 10)}
          {entry.overdue ? ` — ${entry.daysOverdue}d overdue` : ''}
        </span>
      ),
    },
    {
      key: 'returned',
      header: 'Returned',
      render: (entry) =>
        entry.actualReturnDate
          ? `${entry.actualReturnDate.slice(0, 10)}${
              entry.conditionOnReturnName
                ? ` — ${entry.conditionOnReturnName}`
                : ''
            }`
          : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => (
        <StatusBadge status={entry.status} label={assetsLabel(entry.status)} />
      ),
    },
  ];

  const TABS: { id: Tab; name: string }[] = [
    { id: 'documents', name: `Documents (${row.documents.length})` },
    { id: 'allocations', name: 'Allocations' },
    { id: 'stock', name: 'Stock' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} text-2xl`}>
            {row.assetCode} — {row.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <StatusBadge status={row.status} label={assetsLabel(row.status)} />
            <span>{row.categoryName}</span>
            <span>·</span>
            <span>{assetsLabel(row.trackingMode)}</span>
            <span>·</span>
            <span>{row.siteName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => setShowEdit(true)}>
            Edit
          </SecondaryButton>
          {/*
            Allocation is offered only from Idle. Every other status either has the
            asset out already or has it out of service, and the backend refuses all
            of them — a control that always fails is worse than no control.
          */}
          {row.status === 'idle' && (
            <SecondaryButton
              type="button"
              onClick={() => setShowAllocate(true)}
            >
              Allocate
            </SecondaryButton>
          )}
          {/*
            Already out: the control stays, disabled, and the tooltip names the
            allocation in the way. Removing it outright would leave someone looking
            for a button that was there last time and wondering where it went; a
            disabled one that says who has the asset answers the question they were
            about to ask.
          */}
          {row.status === 'allocated' && openAllocation && (
            <>
              <SecondaryButton
                type="button"
                disabled
                title={`Already allocated to ${openAllocation.siteName}${
                  openAllocation.custodianName
                    ? `, held by ${openAllocation.custodianName}`
                    : ''
                }, due back ${openAllocation.expectedReturnDate.slice(0, 10)}.`}
              >
                Allocate
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => setReturning(openAllocation)}
              >
                Record return
              </SecondaryButton>
            </>
          )}
          <SecondaryButton
            type="button"
            onClick={() => setShowDocument(true)}
          >
            Attach a document
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            title={
              openAllocation
                ? 'Return it first — its custody record has to close against a real asset.'
                : undefined
            }
          >
            Retire
          </SecondaryButton>
        </div>
      </div>

      <FormError message={error} />

      <dl className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: row.trackingMode === 'serialised' ? 'Serial number' : 'Quantity',
            value:
              row.trackingMode === 'serialised'
                ? (row.serialNumber ?? '—')
                : formatAssetQuantity(row.quantity, row.unitOfMeasure),
          },
          { label: 'Custodian', value: row.custodianName ?? '—' },
          { label: 'Condition', value: row.conditionGradeName ?? '—' },
          { label: 'Supplier', value: row.vendorName ?? '—' },
          {
            label: 'Purchased',
            value: row.purchaseDate?.slice(0, 10) ?? '—',
          },
          { label: 'Cost', value: formatRupees(row.purchaseCost) },
          // The register speaks in what the asset is worth, not in accounting terms
          // (spec FR-011). No schedule, no "WDV", no journal.
          { label: 'Value now', value: formatRupees(row.bookValue) },
          {
            label: 'Next inspection',
            value: row.nextInspectionDue
              ? `${row.nextInspectionDue.slice(0, 10)}${row.inspectionDue ? ' — due' : ''}`
              : '—',
          },
        ].map((entry) => (
          <div key={entry.label}>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {entry.label}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">{entry.value}</dd>
          </div>
        ))}
      </dl>

      {row.purchaseId && (
        <p className="text-sm text-gray-600">
          Acquired through a recorded purchase —{' '}
          <Link
            href={ROUTES.inventoryPurchases}
            className="text-blue-700 underline hover:text-blue-900"
          >
            open it in Inventory
          </Link>
          .
        </p>
      )}

      <nav aria-label="Asset details" className="overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-gray-200">
          {TABS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-current={tab === entry.id ? 'page' : undefined}
                onClick={() => setTab(entry.id)}
                className={`-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  tab === entry.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                {entry.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'documents' && (
        <ResponsiveList
          columns={documentColumns}
          rows={row.documents}
          rowKey={(doc) => doc.id}
          emptyMessage="No documents attached yet."
          actions={(doc) => (
            <RowAction onClick={() => openDocument(doc.id)}>Open</RowAction>
          )}
        />
      )}

      {tab === 'allocations' && (
        <ResponsiveList
          columns={allocationColumns}
          rows={allocations.data ?? []}
          rowKey={(entry) => entry.id}
          isLoading={allocations.isPending}
          error={allocations.isError ? MESSAGES.loadFailed : undefined}
          emptyMessage="This asset has never been allocated."
          actions={(entry) =>
            entry.status === 'open' ? (
              <RowAction onClick={() => setReturning(entry)}>Return</RowAction>
            ) : null
          }
        />
      )}

      {tab === 'stock' && (
        <ResponsiveList
          columns={[
            { key: 'site', header: 'Site', render: (line) => line.siteName },
            {
              key: 'onHand',
              header: 'On hand',
              render: (line) =>
                formatAssetQuantity(line.onHand, row.unitOfMeasure),
            },
            {
              key: 'allocated',
              header: 'Allocated',
              render: (line) =>
                formatAssetQuantity(line.allocated, row.unitOfMeasure),
            },
            {
              key: 'inTransit',
              header: 'In transit',
              render: (line) =>
                formatAssetQuantity(line.inTransit, row.unitOfMeasure),
            },
          ]}
          rows={row.stock}
          rowKey={(line) => line.siteId}
          emptyMessage="No stock recorded at any site."
        />
      )}

      {showEdit && (
        <AssetModal asset={row} onClose={() => setShowEdit(false)} />
      )}
      {showDocument && (
        <AssetDocumentModal
          assetId={assetId}
          onClose={() => setShowDocument(false)}
        />
      )}
      {showAllocate && (
        <AllocateModal asset={row} onClose={() => setShowAllocate(false)} />
      )}
      {returning && (
        <ReturnModal
          allocation={returning}
          onClose={() => setReturning(null)}
        />
      )}
    </div>
  );
}
