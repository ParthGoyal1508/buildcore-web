'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useState } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';

import {
  downloadStoreDocument,
  getIndents,
  type Indent,
} from '@/app/lib/api/inventory';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  INDENT_STATUSES,
  MESSAGES,
  ROUTES,
  inventoryLabel,
  overdueLabel,
} from '@/app/lib/constants';
import { dateLabel, quantity as formatQuantity } from '@/app/lib/format';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import IndentForm from '@/app/ui/inventory/indent-form';
import { searchSites } from '@/app/ui/inventory/inventory-search';
import StoreDocumentDownload from '@/app/ui/inventory/store-document-download';
import { SelectField } from '@/app/ui/settings/form-fields';
import Pager from '@/app/ui/inventory/pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';
import { useToast } from '@/app/ui/toast';

/**
 * 036 M5, M12 (2026-10-17): the filters live in the URL (Back from an indent keeps them), the
 * store filter searches the server rather than one page of 200 stores, quantities are formatted,
 * a failed load offers Retry, and Raise indent is the screen's primary button.
 */
function IndentsPageBody() {
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [filters, setFilters, query] = useUrlState(
    { status: urlString(), site: urlString(), page: urlNumber(1) },
    { resetPage: 'page' },
  );
  const [showForm, setShowForm] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const canApprove = user?.permissions.includes('INVENTORY_APPROVE') ?? false;

  const params = {
    page: query.page,
    status: query.status || undefined,
    siteId: query.site || undefined,
  };

  const list = useQuery({
    queryKey: ['inventory', 'indents', companyId, params],
    queryFn: () => getIndents(params),
    placeholderData: keepPreviousData,
  });
  const data = list.data;
  const siteRow = data?.indents.find((row) => row.siteId === query.site);

  const columns: Column<Indent>[] = [
    {
      key: 'number',
      header: 'Indent',
      render: (row) => (
        <Link
          href={ROUTES.inventoryIndent(row.id)}
          className="font-medium text-brand-700 hover:underline"
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
          {dateLabel(row.requiredByDate)}
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
        return outstanding > 0 ? formatQuantity(outstanding) : '—';
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
        <PageHeader title="Indents" />
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <Link
              href={ROUTES.inventoryProcurement}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Procurement needed
            </Link>
          )}
          <Button type="button" onClick={() => setShowForm(true)}>
            Raise indent
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          id="indents-status"
          label="Status"
          value={filters.status}
          onChange={(event) => setFilters({ status: event.target.value })}
        >
          <option value="">Any status</option>
          {INDENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {inventoryLabel(value)}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="indents-site" className="font-medium text-gray-700">
            Store
          </label>
          <AsyncSelect
            id="indents-site"
            value={filters.site}
            onChange={(id) => setFilters({ site: id })}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={
              siteRow ? { id: siteRow.siteId, label: siteRow.siteName } : null
            }
            emptyLabel="All stores"
          />
        </div>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.indents ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={list.refetch}
        serverPaged
        isRefreshing={list.isPlaceholderData}
        emptyMessage={MESSAGES.indentsEmpty}
        // The client's Material Indent document (2026-10-15), without opening the indent first.
        actions={(row) => (
          <StoreDocumentDownload
            label="Indent"
            fallbackName={`Indent ${row.indentNumber.replace(/\//g, '-')}`}
            load={(format) => downloadStoreDocument('indent', row.id, format)}
            onError={(message) => toast.error(message)}
          />
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="indent"
      />

      {showForm && <IndentForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

export default function IndentsPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Indent', 'Store', 'Required by', 'Items', 'Outstanding', 'Status']}
          rows={8}
        />
      }
    >
      <IndentsPageBody />
    </Suspense>
  );
}
