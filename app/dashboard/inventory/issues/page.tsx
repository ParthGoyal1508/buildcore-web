'use client';

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  deleteIssue,
  downloadInventoryExport,
  downloadStoreDocument,
  getIssues,
  type Issue,
} from '@/app/lib/api/inventory';
import { INVENTORY_ISSUE_LABEL, MESSAGES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import {
  dateLabel,
  quantity as formatQuantity,
  quantity3,
  todayIso,
} from '@/app/lib/format';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import DailyRegisterDownload from '@/app/ui/inventory/daily-register-download';
import {
  searchItems,
  searchProjects,
  searchSites,
  searchVendors,
} from '@/app/ui/inventory/inventory-search';
import IssueModal from '@/app/ui/inventory/issue-modal';
import IssueReturnModal from '@/app/ui/inventory/issue-return-modal';
import Pager from '@/app/ui/inventory/pager';
import StoreDocumentDownload from '@/app/ui/inventory/store-document-download';
import PageHeader from '@/app/ui/page-header';
import {
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';

/**
 * 036 M5, M12 (2026-10-17):
 * - Filters in the URL, with project, vendor and slip number added (the slip search is debounced);
 *   store, item, project and vendor are server searches, so none stops at 200.
 * - From after To is refused on the spot instead of returning an empty list.
 * - Quantities formatted, and the total issued shown when one item is filtered — the only case in
 *   which adding quantities up means anything.
 * - Excel export of the filtered register, every page.
 */
/** "DLC Concrete for plant foundation · 10 CUM" — the mix a sub-item row was issued as (039). */
function compositeLabel(row: Issue): string {
  return `${row.compositeItemName ?? 'a composite item'} · ${quantity3(
    row.compositeQuantity ?? null,
  )} ${row.compositeUnit ?? ''}`.trim();
}

function IssuesPageBody() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();

  const [filters, setFilters, query] = useUrlState(
    {
      site: urlString(),
      item: urlString(),
      project: urlString(),
      vendor: urlString(),
      slip: urlString(),
      dateFrom: urlString(),
      dateTo: urlString(),
      page: urlNumber(1),
    },
    { debounce: ['slip'], resetPage: 'page' },
  );
  const [showModal, setShowModal] = useState(false);
  const [returning, setReturning] = useState<Issue | null>(null);
  const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const rangeError =
    query.dateFrom && query.dateTo && query.dateFrom > query.dateTo
      ? 'From must be on or before To.'
      : undefined;

  const listFilters = {
    siteId: query.site || undefined,
    itemId: query.item || undefined,
    projectId: query.project || undefined,
    vendorId: query.vendor || undefined,
    slipNo: query.slip.trim() || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
  };
  const params = { ...listFilters, page: query.page };

  const list = useQuery({
    queryKey: ['inventory', 'issues', companyId, params],
    queryFn: () => getIssues(params),
    enabled: !rangeError,
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.issues ?? [];
  const totalQuantity = list.data?.totals?.quantity ?? null;

  const remove = async (row: Issue) => {
    // 039: a sub-item row of a composite issue takes the whole issue with it — every sub-item on
    // the slip goes back to the store — so the dialog says so before, not after.
    const ok = await confirmDialog({
      title: row.issueGroupId
        ? 'Delete this composite issue?'
        : 'Delete this issue?',
      message: row.issueGroupId
        ? `This deletes the whole issue of ${compositeLabel(row)}${
            row.slipNo ? ` on slip ${row.slipNo}` : ''
          }: every sub-item on it goes back to the store, not only ${row.itemName}.`
        : MESSAGES.confirmDeleteIssue,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting((current) => new Set(current).add(row.id));
    try {
      await deleteIssue(row.id);
      toast.success('Issue deleted');
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete this issue.'));
    } finally {
      setDeleting((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await downloadInventoryExport('issues', listFilters);
      saveBlob(blob, `Material issues ${todayIso()}.xlsx`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not produce the Excel file.'));
    } finally {
      setExporting(false);
    }
  };

  // A chosen filter's name, from the rows it matched (a cold URL with no rows shows the box empty
  // but still filters).
  const siteRow = rows.find((row) => row.siteId === query.site);
  const itemRow = rows.find((row) => row.itemId === query.item);
  const projectRow = rows.find((row) => row.projectId === query.project);
  const vendorRow = rows.find((row) => row.vendorId === query.vendor);

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
          <span
            className={
              row.slipNo
                ? 'whitespace-nowrap text-xs text-gray-500'
                : 'whitespace-nowrap'
            }
          >
            {dateLabel(row.date)}
          </span>
        </span>
      ),
    },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'item',
      header: 'Item',
      // 039: a composite issue's rows each name the mix they went out as, "DLC Concrete · 10 CUM".
      render: (row) =>
        row.compositeItemId ? (
          <span>
            {`${row.itemName} (${row.unit})`}
            <span className="block text-xs text-gray-500">
              Part of {compositeLabel(row)}
            </span>
          </span>
        ) : (
          `${row.itemName} (${row.unit})`
        ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      className: 'text-right tabular-nums',
      sortValue: (row) => row.quantity,
      // A composite's sub-quantities are kept to three decimals (0.827 MT per CUM).
      render: (row) =>
        row.compositeItemId
          ? quantity3(row.quantity)
          : formatQuantity(row.quantity),
    },
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
            {formatQuantity(row.returnedQuantity)}
            <span className="block text-xs text-gray-500">
              {dateLabel(row.returnedOn)}
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
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            onClick={() => void exportExcel()}
            loading={exporting}
            disabled={Boolean(rangeError)}
          >
            Excel
          </SecondaryButton>
          <Button type="button" onClick={() => setShowModal(true)}>
            New issue
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issues-site" className="font-medium text-gray-700">
            Store
          </label>
          <AsyncSelect
            id="issues-site"
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

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issues-item" className="font-medium text-gray-700">
            Item
          </label>
          <AsyncSelect
            id="issues-item"
            value={filters.item}
            onChange={(id) => setFilters({ item: id })}
            search={searchItems}
            cacheKey={['inventory', 'items', 'search', companyId]}
            selectedOption={
              itemRow
                ? {
                    id: itemRow.itemId,
                    label: itemRow.itemName,
                    sublabel: itemRow.itemCode,
                  }
                : null
            }
            emptyLabel="All items"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issues-project" className="font-medium text-gray-700">
            Project
          </label>
          <AsyncSelect
            id="issues-project"
            value={filters.project}
            onChange={(id) => setFilters({ project: id })}
            search={searchProjects}
            cacheKey={['inventory', 'projects', 'search', companyId]}
            selectedOption={
              projectRow?.projectId
                ? {
                    id: projectRow.projectId,
                    label: projectRow.projectName ?? '',
                  }
                : null
            }
            emptyLabel="All projects"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="issues-vendor" className="font-medium text-gray-700">
            Vendor
          </label>
          <AsyncSelect
            id="issues-vendor"
            value={filters.vendor}
            onChange={(id) => setFilters({ vendor: id })}
            search={searchVendors}
            cacheKey={['inventory', 'vendors', 'search', companyId]}
            selectedOption={
              vendorRow?.vendorId
                ? { id: vendorRow.vendorId, label: vendorRow.vendorName ?? '' }
                : null
            }
            emptyLabel="All vendors"
          />
        </div>

        <TextField
          id="issues-slip"
          label="Slip no."
          type="search"
          autoComplete="off"
          placeholder="Part of a slip number"
          value={filters.slip}
          onChange={(event) => setFilters({ slip: event.target.value })}
        />
        <TextField
          id="issues-from"
          label="From"
          type="date"
          max={filters.dateTo || undefined}
          value={filters.dateFrom}
          onChange={(event) => setFilters({ dateFrom: event.target.value })}
          error={rangeError}
        />
        <TextField
          id="issues-to"
          label="To"
          type="date"
          min={filters.dateFrom || undefined}
          value={filters.dateTo}
          onChange={(event) => setFilters({ dateTo: event.target.value })}
        />
      </div>

      <DailyRegisterDownload
        defaultSiteId={query.site || undefined}
        defaultSiteLabel={siteRow?.siteName}
      />

      {totalQuantity !== null && rows.length > 0 && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Total issued for this filter:{' '}
          <span className="font-medium tabular-nums">
            {formatQuantity(totalQuantity)} {rows[0].unit}
          </span>
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={list.isPending && !rangeError}
        error={list.error}
        onRetry={list.refetch}
        serverPaged
        isRefreshing={list.isPlaceholderData}
        emptyMessage={MESSAGES.issuesEmpty}
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            <StoreDocumentDownload
              label="Slip"
              fallbackName={`Issue slip ${row.slipNo ?? row.date.slice(0, 10)}`}
              load={(format) =>
                downloadStoreDocument('issue-slip', row.id, format)
              }
              onError={(message) => toast.error(message)}
            />
            {/* Nothing left to come back once all of it has. */}
            {(row.returnedQuantity ?? 0) < row.quantity && (
              <RowAction onClick={() => setReturning(row)}>Return</RowAction>
            )}
            <RowAction
              onClick={() => void remove(row)}
              loading={deleting.has(row.id)}
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      <Pager
        total={list.data?.total ?? 0}
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
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

export default function IssuesPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Slip No. / Date', 'Store', 'Item', 'Qty', 'Issued to', 'Returned']}
          rows={8}
        />
      }
    >
      <IssuesPageBody />
    </Suspense>
  );
}
