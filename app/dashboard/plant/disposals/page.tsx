'use client';

import { ArchiveBoxXMarkIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import {
  downloadDisposals,
  getDisposalAttachment,
  getDisposals,
  type DisposalFilters,
  type EquipmentDisposal,
} from '@/app/lib/api/plant';
import { getProjects } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { formatRupees } from '@/app/lib/utils';
import { dateLabel } from '@/app/lib/format';
import PageHeader from '@/app/ui/page-header';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import CategoryOptions from '@/app/ui/plant/category-options';
import { DisposalFacts } from '@/app/ui/plant/equipment-disposal-panel';
import { usePlantCategories } from '@/app/ui/plant/use-plant-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import Pager from '@/app/ui/inventory/pager';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (v: number | null) => (v === null ? '—' : formatRupees(v));

/**
 * Scrapped & Sold Machines (2026-10-17): what has left the fleet, what it fetched, and whether the
 * sales made or lost money against book value. Reversed disposals are not counted — the machine is
 * back in service.
 */
/** Rows per screen page (036 K18). */
const DISPOSAL_PAGE = 25;

export default function DisposalsPage() {
  const [type, setType] = useState<'' | 'scrapped' | 'sold'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<EquipmentDisposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show, viewer } = useFileViewer();

  const filters: DisposalFilters = {
    ...(type ? { type } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const filtered = Object.keys(filters).length > 0;
  // Back to the first page whenever the filters change (React's "adjust state while rendering").
  const filterKey = JSON.stringify(filters);
  const [listPage, setListPage] = useState(1);
  const [pagedFor, setPagedFor] = useState(filterKey);
  if (pagedFor !== filterKey) {
    setPagedFor(filterKey);
    setListPage(1);
  }

  const categories = usePlantCategories();
  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
    retry: false,
  });
  const data = useQuery({
    queryKey: ['plant', 'disposals', filters],
    queryFn: () => getDisposals(filters),
  });

  const exportXlsx = useMutation({
    mutationFn: () => downloadDisposals(filters),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: () => setError('Could not create the Excel file.'),
  });

  const columns: Column<EquipmentDisposal>[] = [
    {
      key: 'code',
      header: 'Machine ID',
      render: (r) => (
        <Link
          href={ROUTES.plantEquipmentDetail(r.equipmentId)}
          className="font-mono text-brand-700 hover:underline"
        >
          {r.equipmentCode}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', render: (r) => r.equipmentName },
    { key: 'category', header: 'Category', render: (r) => r.categoryName ?? '—', hideOnCard: true },
    {
      key: 'makeModel',
      header: 'Make / Model',
      render: (r) => [r.make, r.model].filter(Boolean).join(' / ') || '—',
      hideOnCard: true,
    },
    { key: 'purchaseDate', header: 'Purchase date', render: (r) => dateLabel(r.purchaseDate), hideOnCard: true },
    {
      key: 'purchaseCost',
      header: 'Purchase cost',
      render: (r) => money(r.purchaseCost),
      sortValue: (r) => r.purchaseCost ?? -1,
      hideOnCard: true,
    },
    {
      key: 'type',
      header: 'Disposal',
      render: (r) => (
        <StatusBadge status={r.type} label={r.type === 'sold' ? 'Sold' : 'Scrapped'} />
      ),
    },
    { key: 'date', header: 'Date', render: (r) => dateLabel(r.disposalDate) },
    {
      key: 'value',
      header: 'Value realised',
      render: (r) => money(r.valueRealised),
      sortValue: (r) => r.valueRealised ?? -1,
    },
    {
      key: 'pl',
      header: 'Profit / Loss',
      render: (r) =>
        r.profitLoss === null ? (
          '—'
        ) : (
          <span className={r.profitLoss < 0 ? 'text-red-700' : 'text-green-700'}>
            {formatRupees(r.profitLoss)}
          </span>
        ),
      sortValue: (r) => r.profitLoss ?? 0,
    },
    { key: 'party', header: 'Buyer / Vendor', render: (r) => r.counterpartyName ?? '—', hideOnCard: true },
    { key: 'approvedBy', header: 'Approved by', render: (r) => r.approvedBy, hideOnCard: true },
  ];

  const summary = data.data?.summary;
  const cards: { label: string; value: string; tone?: 'good' | 'bad' }[] = summary
    ? [
        { label: 'Total scrapped', value: String(summary.totalScrapped) },
        { label: 'Total sold', value: String(summary.totalSold) },
        { label: 'Sale value realised', value: formatRupees(summary.saleValueRealised) },
        { label: 'Scrap value realised', value: formatRupees(summary.scrapValueRealised) },
        {
          label: 'Net profit / loss on sales',
          value: formatRupees(summary.netProfitLossOnSales),
          tone:
            summary.netProfitLossOnSales < 0
              ? 'bad'
              : summary.netProfitLossOnSales > 0
              ? 'good'
              : undefined,
        },
      ]
    : [];

  const nothingEver = data.data && data.data.items.length === 0 && !filtered;

  return (
    <div className="flex flex-col gap-6">
      {viewer}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Scrapped & Sold Machines"
          description="Machines retired from the fleet, what they realised and the profit or loss on sales."
        />
        <SecondaryButton
          onClick={() => {
            setError(null);
            exportXlsx.mutate();
          }}
          disabled={exportXlsx.isPending || !data.data || data.data.items.length === 0}
        >
          {exportXlsx.isPending ? 'Excel…' : 'Excel'}
        </SecondaryButton>
      </div>
      <FormError message={error} />

      {data.isPending ? (
        <ListSkeleton
          headers={['Machine ID', 'Name', 'Disposal', 'Date', 'Value realised']}
          rows={6}
        />
      ) : data.isError ? (
        <QueryError
          error={data.error}
          fallback={MESSAGES.plantLoadFailed}
          onRetry={data.refetch}
        />
      ) : nothingEver ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center">
          <ArchiveBoxXMarkIcon className="w-10 text-gray-400" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-900">No machine has been scrapped or sold yet.</p>
          <p className="text-sm text-gray-500">
            Use Dispose on a machine in the register to retire it; it will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p
                  className={clsx(
                    'mt-1 text-lg font-semibold',
                    c.tone === 'bad'
                      ? 'text-red-700'
                      : c.tone === 'good'
                      ? 'text-green-700'
                      : 'text-gray-900',
                  )}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <MonthChart months={data.data.byMonth} />
        </>
      )}

      {!nothingEver && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TextField
              id="dsp-search"
              label="Search"
              placeholder="Machine, make, buyer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <SelectField
              id="dsp-type"
              label="Disposal type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="">Scrapped and sold</option>
              <option value="scrapped">Scrapped</option>
              <option value="sold">Sold</option>
            </SelectField>
            <TextField id="dsp-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField id="dsp-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <SelectField
              id="dsp-category"
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">All categories</option>
              <CategoryOptions categories={categories.data ?? []} />
            </SelectField>
            <SelectField
              id="dsp-project"
              label="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </div>

          <ResponsiveList
            columns={columns}
            // 036 K18: paged on the screen — the summary and chart above need every row, so the
            // API returns them together; 25 at a time keeps a long history readable on a phone.
            rows={(data.data?.items ?? []).slice(
              (listPage - 1) * DISPOSAL_PAGE,
              listPage * DISPOSAL_PAGE,
            )}
            rowKey={(r) => r.id}
            isLoading={data.isPending}
            emptyMessage="No disposals match these filters."
            actions={(r) => (
              <RowAction intent="read" onClick={() => setViewing(r)}>
                View
              </RowAction>
            )}
          />
          <Pager
            total={data.data?.items.length ?? 0}
            page={listPage}
            pageSize={DISPOSAL_PAGE}
            onPageChange={setListPage}
            noun="disposal"
          />
        </>
      )}

      {viewing && (
        <Modal
          title={`${viewing.equipmentCode} · ${viewing.equipmentName} — ${
            viewing.type === 'sold' ? 'Sold' : 'Scrapped'
          }`}
          onClose={() => setViewing(null)}
          wide
        >
          <DisposalFacts
            disposal={viewing}
            onOpenAttachment={async () => {
              try {
                show(
                  await getDisposalAttachment(viewing.id),
                  viewing.attachmentName ?? 'Attachment',
                );
              } catch {
                setError('Could not open the attachment.');
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

/** Disposals per month, scrapped and sold stacked — plain bars, no chart library for one picture. */
function MonthChart({
  months,
}: {
  months: { month: string; scrapped: number; sold: number }[];
}) {
  const max = Math.max(1, ...months.map((m) => m.scrapped + m.sold));
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4" aria-labelledby="dsp-chart">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="dsp-chart" className="text-sm font-semibold text-gray-900">
          Disposals by month
        </h2>
        <div className="flex gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-400" aria-hidden="true" /> Scrapped
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-500" aria-hidden="true" /> Sold
          </span>
        </div>
      </div>
      <div className="flex h-32 items-end gap-1 overflow-x-auto" role="list">
        {months.map((m) => {
          const [y, mm] = m.month.split('-').map(Number);
          const label = `${MONTH_SHORT[mm - 1]} ${String(y).slice(2)}`;
          return (
            <div
              key={m.month}
              role="listitem"
              aria-label={`${label}: ${m.scrapped} scrapped, ${m.sold} sold`}
              title={`${label}: ${m.scrapped} scrapped, ${m.sold} sold`}
              className="flex min-w-[2rem] flex-1 flex-col items-center gap-1"
            >
              <div className="flex h-24 w-full flex-col justify-end">
                <div className="bg-slate-500" style={{ height: `${(m.sold / max) * 100}%` }} />
                <div className="rounded-t-sm bg-red-400" style={{ height: `${(m.scrapped / max) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
