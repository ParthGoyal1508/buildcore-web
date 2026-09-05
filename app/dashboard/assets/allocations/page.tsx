'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  getAllocations,
  getOutstandingCustody,
  type Allocation,
} from '@/app/lib/api/assets';
import {
  ASSET_ALLOCATION_STATUSES,
  MESSAGES,
  ROUTES,
  assetsLabel,
  formatAssetQuantity,
} from '@/app/lib/constants';
import ReturnModal from '@/app/ui/assets/return-modal';
import {
  useAssetProjects,
  useAssetSites,
  useAssetsCompanyId,
} from '@/app/ui/assets/use-asset-refs';
import { lusitana } from '@/app/ui/fonts';
import Pager from '@/app/ui/inventory/pager';
import {
  RowAction,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

type View = 'allocations' | 'custody';

/**
 * Allocations, and the custody register beside them (spec US4, FR-011).
 *
 * Two views of the same data rather than two screens: "what is out" and "who is
 * holding it" are the same question asked by a store keeper and by a project
 * manager, and splitting them across routes makes each of them navigate to find the
 * other's answer.
 */
export default function AllocationsPage() {
  const companyId = useAssetsCompanyId();
  const projects = useAssetProjects();
  const sites = useAssetSites();

  const [view, setView] = useState<View>('allocations');
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('open');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [returning, setReturning] = useState<Allocation | null>(null);

  const filters = {
    page,
    ...(companyId ? { companyId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(overdueOnly ? { overdue: true } : status ? { status } : {}),
  };

  const list = useQuery({
    queryKey: ['assets', 'allocations', filters],
    queryFn: () => getAllocations(filters),
    enabled: view === 'allocations',
  });

  const custody = useQuery({
    queryKey: ['assets', 'custody', 'all', companyId],
    queryFn: () => getOutstandingCustody(companyId ?? undefined),
    enabled: view === 'custody',
  });

  const columns: Column<Allocation>[] = [
    {
      key: 'asset',
      header: 'Asset',
      render: (row) => (
        <Link
          href={ROUTES.assetsAsset(row.assetId)}
          className="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {row.assetCode}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', hideOnCard: true, render: (row) => row.assetName },
    { key: 'site', header: 'Site', render: (row) => row.siteName },
    {
      key: 'custodian',
      header: 'Custodian',
      render: (row) => row.custodianName ?? '—',
    },
    {
      key: 'quantity',
      header: 'Quantity',
      hideOnCard: true,
      render: (row) => formatAssetQuantity(row.quantity, null),
    },
    {
      key: 'due',
      header: 'Due back',
      render: (row) => (
        <span className={row.overdue ? 'font-medium text-red-700' : undefined}>
          {row.expectedReturnDate.slice(0, 10)}
          {row.overdue ? ` — ${row.daysOverdue}d overdue` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={assetsLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Allocations</h1>
        <div className="flex gap-2">
          <RowAction
            onClick={() => setView('allocations')}
            aria-current={view === 'allocations' ? 'true' : undefined}
            className={view === 'allocations' ? 'bg-gray-100' : undefined}
          >
            All allocations
          </RowAction>
          <RowAction
            onClick={() => setView('custody')}
            aria-current={view === 'custody' ? 'true' : undefined}
            className={view === 'custody' ? 'bg-gray-100' : undefined}
          >
            By custodian
          </RowAction>
        </div>
      </div>

      {view === 'allocations' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              id="allocation-filter-project"
              label="Project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All projects</option>
              {(projects.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="allocation-filter-site"
              label="Site"
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All sites</option>
              {(sites.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="allocation-filter-status"
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOverdueOnly(false);
                setPage(1);
              }}
              disabled={overdueOnly}
            >
              <option value="">Open and returned</option>
              {ASSET_ALLOCATION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {assetsLabel(value)}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="allocation-filter-overdue"
              label="Overdue"
              value={overdueOnly ? 'yes' : ''}
              onChange={(event) => {
                setOverdueOnly(event.target.value === 'yes');
                setPage(1);
              }}
              hint="Open allocations past their return date."
            >
              <option value="">Everything</option>
              <option value="yes">Overdue only</option>
            </SelectField>
          </div>

          <ResponsiveList
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={(row) => row.id}
            isLoading={list.isPending}
            error={list.isError ? MESSAGES.assetsLoadFailed : undefined}
            emptyMessage={
              projectId || siteId || overdueOnly
                ? MESSAGES.assetsAllocationsEmptyFiltered
                : MESSAGES.assetsAllocationsEmpty
            }
            actions={(row) =>
              row.status === 'open' ? (
                <RowAction onClick={() => setReturning(row)}>Return</RowAction>
              ) : null
            }
          />

          <Pager
            total={list.data?.total ?? 0}
            page={list.data?.page ?? 1}
            pageSize={list.data?.pageSize ?? 25}
            onPageChange={setPage}
            noun="allocation"
          />
        </>
      )}

      {view === 'custody' && (
        <div className="flex flex-col gap-4">
          {custody.isPending && (
            <p className="p-4 text-sm text-gray-500" role="status">
              Loading…
            </p>
          )}
          {custody.isError && (
            <p className="p-4 text-sm text-red-600" role="alert">
              {MESSAGES.assetsLoadFailed}
            </p>
          )}
          {custody.data?.length === 0 && (
            <p className="p-4 text-sm text-gray-500">
              {MESSAGES.assetsCustodyEmpty}
            </p>
          )}
          {(custody.data ?? []).map((group) => (
            <section
              key={group.custodianEmployeeId}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-gray-900">
                {group.custodianName}
                <span className="ml-2 text-xs font-normal text-gray-600">
                  {group.allocations.length} asset(s)
                </span>
                {group.overdueCount > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    {group.overdueCount} overdue
                  </span>
                )}
              </h2>
              <ul className="mt-3 divide-y divide-gray-100">
                {group.allocations.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="text-sm text-gray-900">
                      <Link
                        href={ROUTES.assetsAsset(entry.assetId)}
                        className="text-blue-700 underline hover:text-blue-900"
                      >
                        {entry.assetCode}
                      </Link>{' '}
                      {entry.assetName} · {entry.siteName}
                    </span>
                    <span className="flex items-center gap-3">
                      <span
                        className={`text-sm ${entry.overdue ? 'text-red-700' : 'text-gray-600'}`}
                      >
                        due {entry.expectedReturnDate.slice(0, 10)}
                        {entry.overdue ? ` (${entry.daysOverdue}d over)` : ''}
                      </span>
                      <RowAction onClick={() => setReturning(entry)}>
                        Return
                      </RowAction>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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
