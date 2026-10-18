'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  BG_STATUS_FILTERS,
  type BgStatusFilter,
  type BgTenderListItem,
  downloadBgRegister,
  listBgTenders,
} from '@/app/lib/api/bank-guarantees';
import { errorMessage } from '@/app/lib/api/client';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { useUrlState, urlNumber, urlString } from '@/app/lib/use-url-state';
import { Button, SecondaryButton } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import {
  BG_FILTER_LABELS,
  GuaranteeCell,
  bgMoney,
} from '@/app/ui/projects/bank-guarantee-parts';
import BgTenderModal from '@/app/ui/projects/bg-tender-modal';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { useToast } from '@/app/ui/toast';

const PAGE_SIZE = 25;

/**
 * The Bank Guarantees register (037) — the client's "TENDER BG DETAILS" sheet as a screen.
 *
 * One row per tender, its EMD and PBG side by side as in the sheet; several of one type stack in
 * the cell. A guarantee inside the 30-day alert window shows how long it has left, in amber, so
 * the register answers "what needs attention" before any filter is touched. Excel downloads the
 * sheet in the client's own columns, with the filters applied.
 */
export default function BankGuaranteesPage() {
  const router = useRouter();
  const toast = useToast();
  // `filters` is what the fields show; `applied` is the URL, the search a beat behind typing.
  const [filters, setFilters, applied] = useUrlState(
    { q: urlString(), status: urlString(), page: urlNumber(1) },
    { debounce: ['q'], resetPage: 'page' },
  );
  const [adding, setAdding] = useState(false);

  const status: BgStatusFilter | '' = (BG_STATUS_FILTERS as readonly string[]).includes(
    applied.status,
  )
    ? (applied.status as BgStatusFilter)
    : '';
  const query = {
    search: applied.q.trim() || undefined,
    status,
    page: applied.page,
    pageSize: PAGE_SIZE,
  };

  const list = useQuery({
    queryKey: ['projects', 'bank-guarantees', 'list', query],
    queryFn: () => listBgTenders(query),
    placeholderData: keepPreviousData,
  });

  const download = useMutation({
    mutationFn: () => downloadBgRegister({ search: query.search, status }),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (error) => toast.error(errorMessage(error, 'Could not download the register.')),
  });

  const columns: Column<BgTenderListItem>[] = [
    {
      key: 'serial',
      header: 'Sr. No',
      render: (row) => <span className="tabular-nums">{row.serialNo}</span>,
    },
    {
      key: 'work',
      header: 'Work name',
      render: (row) => (
        <div className="min-w-[14rem] max-w-md">
          <p className="line-clamp-3 font-medium text-gray-900">{row.workName}</p>
          {row.projectName && (
            <p className="mt-0.5 text-xs text-gray-500">Project: {row.projectName}</p>
          )}
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => row.departmentName },
    {
      key: 'tenderAmount',
      header: 'Tender amount',
      render: (row) => <span className="tabular-nums">{bgMoney(row.tenderAmount)}</span>,
    },
    {
      key: 'emd',
      header: 'EMD',
      render: (row) => (
        <GuaranteeCell guarantees={row.guarantees.filter((g) => g.type === 'EMD')} />
      ),
    },
    {
      key: 'pbg',
      header: 'PBG',
      render: (row) => (
        <GuaranteeCell guarantees={row.guarantees.filter((g) => g.type === 'PBG')} />
      ),
    },
  ];

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main>
      <PageHeader
        title="Bank Guarantees"
        description="EMD and performance guarantees for each tender. Holders of the Bank Guarantees permission are alerted 30 days before one expires."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              onClick={() => download.mutate()}
              loading={download.isPending}
              disabled={total === 0}
            >
              Excel
            </SecondaryButton>
            <Button onClick={() => setAdding(true)}>Add tender</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField
          id="bg-search"
          label="Search"
          placeholder="Work, department, bank or BG number"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
        <SelectField
          id="bg-status"
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
        >
          <option value="">All</option>
          {BG_STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>
              {BG_FILTER_LABELS[value]}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => ROUTES.projectsBankGuarantee(row.id)}
        isLoading={list.isLoading}
        error={list.isError ? MESSAGES.loadFailed : null}
        emptyMessage={
          applied.q || status
            ? 'No tender matches these filters.'
            : 'No bank guarantees yet. Add a tender, then its EMD and PBG guarantees.'
        }
      />

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {applied.page} of {pages} · {total} tenders
          </span>
          <div className="flex gap-2">
            <SecondaryButton
              disabled={applied.page <= 1}
              onClick={() => setFilters({ page: applied.page - 1 })}
            >
              Previous
            </SecondaryButton>
            <SecondaryButton
              disabled={applied.page >= pages}
              onClick={() => setFilters({ page: applied.page + 1 })}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      )}

      {adding && (
        <BgTenderModal
          tender={null}
          onClose={() => setAdding(false)}
          onSaved={(tender) => router.push(ROUTES.projectsBankGuarantee(tender.id))}
        />
      )}
    </main>
  );
}
