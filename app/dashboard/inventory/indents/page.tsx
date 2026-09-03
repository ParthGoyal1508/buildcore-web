'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { getIndents, type Indent } from '@/app/lib/api/inventory';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  INDENT_STATUSES,
  MESSAGES,
  ROUTES,
  inventoryLabel,
  overdueLabel,
} from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import IndentForm from '@/app/ui/inventory/indent-form';
import { useSites } from '@/app/ui/inventory/use-inventory-refs';
import {
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import Pager from '@/app/ui/inventory/pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function IndentsPage() {
  const sites = useSites();
  const [status, setStatus] = useState('');
  const [siteId, setSiteId] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const canApprove = user?.permissions.includes('INVENTORY_APPROVE') ?? false;

  const filters = {
    page,
    ...(status ? { status } : {}),
    ...(siteId ? { siteId } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'indents', filters],
    queryFn: () => getIndents(filters),
  });

  const columns: Column<Indent>[] = [
    {
      key: 'number',
      header: 'Indent',
      render: (row) => (
        <Link
          href={ROUTES.inventoryIndent(row.id)}
          className="font-medium text-blue-700 hover:underline"
        >
          {row.indentNumber}
        </Link>
      ),
    },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'requiredBy',
      header: 'Required by',
      render: (row) => (
        <span>
          {row.requiredByDate.slice(0, 10)}
          {row.overdue && (
            <span className="block text-xs font-medium text-red-700">
              {overdueLabel(row.overdueByDays)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Items',
      render: (row) => row.lines.length,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (row) => {
        // Summed across lines only for display. Each line's own figure is always
        // approved minus fulfilled, and the detail screen shows them per line.
        const outstanding = row.lines.reduce(
          (total, line) => total + (line.outstandingQuantity ?? 0),
          0,
        );
        return outstanding > 0 ? outstanding : '—';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={inventoryLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Indents</h1>
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <Link
              href={ROUTES.inventoryProcurement}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Procurement needed
            </Link>
          )}
          <SecondaryButton type="button" onClick={() => setShowForm(true)}>
            Raise indent
          </SecondaryButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          id="indents-status"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {INDENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {inventoryLabel(value)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="indents-site"
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
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.indents ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.indentsEmpty}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        noun="indent"
      />

      {showForm && <IndentForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
