'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteIssue,
  downloadStoreDocument,
  getIssues,
  type Issue,
} from '@/app/lib/api/inventory';
import { INVENTORY_ISSUE_LABEL, MESSAGES } from '@/app/lib/constants';
import DailyRegisterDownload from '@/app/ui/inventory/daily-register-download';
import IssueModal from '@/app/ui/inventory/issue-modal';
import IssueReturnModal from '@/app/ui/inventory/issue-return-modal';
import StoreDocumentDownload from '@/app/ui/inventory/store-document-download';
import { useItems, useSites } from '@/app/ui/inventory/use-inventory-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Pager from '@/app/ui/inventory/pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import PageHeader from '@/app/ui/page-header';
import { confirmDialog } from '@/app/ui/dialogs';

export default function IssuesPage() {
  const queryClient = useQueryClient();
  const sites = useSites();
  const items = useItems();

  const [siteId, setSiteId] = useState('');
  const [itemId, setItemId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [returning, setReturning] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    page,
    ...(siteId ? { siteId } : {}),
    ...(itemId ? { itemId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'issues', filters],
    queryFn: () => getIssues(filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteIssue(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete this issue.',
      ),
  });

  const columns: Column<Issue>[] = [
    {
      key: 'date',
      header: 'Slip No. / Date',
      // One cell, so the extra column (2026-10-15) does not push the row's actions off the
      // table. Issues recorded before the MIS series have no slip number, only their date.
      render: (row) => (
        <span>
          {row.slipNo && (
            <span className="block whitespace-nowrap font-mono text-gray-900">
              {row.slipNo}
            </span>
          )}
          <span className={row.slipNo ? 'text-xs text-gray-500' : undefined}>
            {row.date.slice(0, 10)}
          </span>
        </span>
      ),
    },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'quantity', header: 'Qty', render: (row) => row.quantity },
    {
      key: 'issuedTo',
      header: 'Issued to',
      // The vendor or subcontractor, with their person under it when one was named — and the
      // machine it went to, when there was one (2026-10-15).
      render: (row) => (
        <span>
          {row.vendorName ?? row.issuedTo}
          {row.vendorName && row.issuedTo !== row.vendorName && (
            <span className="block text-xs text-gray-500">{row.issuedTo}</span>
          )}
          {row.equipmentNo && (
            <span className="block text-xs text-gray-500">
              Equipment {row.equipmentNo}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'returned',
      header: 'Returned',
      // The register's "Received Qty / Returned On / Received By", in one cell.
      render: (row) =>
        row.returnedQuantity ? (
          <span>
            {row.returnedQuantity}
            <span className="block text-xs text-gray-500">
              {row.returnedOn?.slice(0, 10)}
              {row.receivedBy ? ` · ${row.receivedBy}` : ''}
            </span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'project',
      header: 'Project',
      hideOnCard: true,
      render: (row) => row.projectName ?? '—',
    },
    {
      key: 'work',
      header: 'Against',
      hideOnCard: true,
      // The BOQ or activity link is optional by design (009 FR-019), so most rows
      // legitimately have none. A dash, not an alarm.
      render: (row) =>
        row.activityId || row.boqItemId ? 'BOQ / activity' : '—',
    },
    {
      key: 'indent',
      header: 'Indent',
      hideOnCard: true,
      render: (row) => (row.indentLineId ? 'Yes' : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={INVENTORY_ISSUE_LABEL} />
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          New issue
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="issues-site"
          label="Store"
          value={siteId}
          onChange={(event) => {
            setSiteId(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        >
          <option value="">All stores</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="issues-item"
          label="Item"
          value={itemId}
          onChange={(event) => {
            setItemId(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        >
          <option value="">All items</option>
          {(items.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="issues-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
        <TextField
          id="issues-to"
          label="To"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
      </div>

      <DailyRegisterDownload defaultSiteId={siteId || undefined} />

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.issues ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.issuesEmpty}
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            <StoreDocumentDownload
              label="Slip"
              fallbackName={`Issue slip ${row.slipNo ?? row.date.slice(0, 10)}`}
              load={(format) =>
                downloadStoreDocument('issue-slip', row.id, format)
              }
              onError={setError}
            />
            {/* Nothing left to come back once all of it has. */}
            {(row.returnedQuantity ?? 0) < row.quantity && (
              <RowAction onClick={() => setReturning(row)}>Return</RowAction>
            )}
            <RowAction
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Delete this issue?',
                    message: MESSAGES.confirmDeleteIssue,
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                ) {
                  remove.mutate(row.id);
                }
              }}
              disabled={remove.isPending}
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="issue"
      />

      {showModal && <IssueModal onClose={() => setShowModal(false)} />}
      {returning && (
        <IssueReturnModal
          issue={returning}
          onClose={() => setReturning(null)}
        />
      )}
    </div>
  );
}
