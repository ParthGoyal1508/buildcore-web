'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { deleteIssue, getIssues, type Issue } from '@/app/lib/api/inventory';
import { MESSAGES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import IssueModal from '@/app/ui/inventory/issue-modal';
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
    { key: 'date', header: 'Date', render: (row) => row.date.slice(0, 10) },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'quantity', header: 'Qty', render: (row) => row.quantity },
    { key: 'issuedTo', header: 'Issued to', render: (row) => row.issuedTo },
    {
      key: 'work',
      header: 'Against',
      hideOnCard: true,
      // The BOQ or activity link is optional by design (009 FR-019), so most rows
      // legitimately have none. A dash, not an alarm.
      render: (row) => (row.activityId || row.boqItemId ? 'BOQ / activity' : '—'),
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
        <h1 className={`${lusitana.className} text-2xl`}>Issues</h1>
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

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.issues ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.issuesEmpty}
        actions={(row) => (
          <RowAction
            onClick={() => {
              if (window.confirm(MESSAGES.confirmDeleteIssue)) {
                remove.mutate(row.id);
              }
            }}
            disabled={remove.isPending}
          >
            Delete
          </RowAction>
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
    </div>
  );
}
