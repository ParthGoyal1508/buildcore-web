'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import clsx from 'clsx';

import { errorMessage } from '@/app/lib/api/client';
import {
  exportRagMatrix,
  getRagMatrix,
  type RagMatrix,
} from '@/app/lib/api/partners';
import {
  ROUTES,
  partnersLabel,
  RAG_CELL_STATUSES,
  type RagCellStatus,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { financialYearOf, periodLabel } from '@/app/lib/format';
import { urlEnum, urlString, useUrlState } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';
import {
  SortHeader,
  TABLE,
  useSortedRows,
  type SortableColumn,
} from '@/app/ui/table';

/** Dot colours. Distinct from `StatusBadge` because a dot has no text to carry the
 * meaning, so each one gets a `title` and an accessible label instead. */
const DOT_CLASSES: Record<RagCellStatus, string> = {
  verified: 'bg-green-600',
  submitted: 'bg-brand-500',
  partial: 'bg-amber-500',
  missing: 'bg-red-600',
  gray: 'bg-gray-200',
};

/** The five financial years a user might reasonably look at. */
function recentFinancialYears(count = 5): string[] {
  const current = financialYearOf();
  const startYear = Number(current.slice(0, 4));
  return Array.from({ length: count }, (_, index) => {
    const year = startYear - index;
    return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  });
}

type RagRow = RagMatrix['rows'][number];

// Only the contractor sorts: the month columns are a calendar read across, and a dot has no
// order of its own worth imposing on the matrix (2026-10-15).
const RAG_COLUMNS: SortableColumn<RagRow>[] = [
  {
    key: 'contractor',
    render: (row) => row.contractorName,
    sortValue: (row) => row.contractorName,
  },
];

function RagTable({ data }: { data: RagMatrix }) {
  const router = useRouter();
  const { sorted, sort, toggle } = useSortedRows(data.rows, RAG_COLUMNS);
  return (
    <>
      {/* The overflow lives on this container, so the page body never scrolls
          sideways however many months are shown (Principle VI). */}
      <div className={TABLE.wrap}>
        <table className={clsx(TABLE.table, 'min-w-max border-collapse')}>
          <caption className="sr-only">
            Monthly PF and ESIC compliance for {data.fy}
          </caption>
          <thead className={TABLE.thead}>
            <tr>
              <SortHeader
                label="Contractor"
                columnKey="contractor"
                sort={sort}
                onSort={toggle}
                className="sticky left-0 z-20 bg-gray-50"
              />
              {data.months.map((month) => (
                <th
                  key={month}
                  scope="col"
                  className={clsx(TABLE.th, 'text-center')}
                >
                  {periodLabel(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.contractorProfileId} className={TABLE.row}>
                <th
                  scope="row"
                  className={clsx(
                    TABLE.td,
                    TABLE.stickyCell,
                    'text-left font-medium text-gray-900',
                  )}
                >
                  {row.contractorName}
                </th>
                {row.cells.map((cell) => {
                  const label = `${row.contractorName}, ${periodLabel(cell.month)}: ${partnersLabel(cell.status)}`;
                  const clickable = cell.status !== 'gray';
                  return (
                    <td
                      key={cell.month}
                      className={clsx(TABLE.td, 'text-center')}
                    >
                      {/* A real <button>, not a div — every cell is reachable by
                          keyboard, and a not-yet-due month is `disabled` rather
                          than merely unclickable. */}
                      <button
                        type="button"
                        disabled={!clickable}
                        title={label}
                        aria-label={label}
                        onClick={() =>
                          router.push(
                            `${ROUTES.partnersCompliance}?contractorId=${row.contractorProfileId}&month=${cell.month}`,
                          )
                        }
                        className={clsx(
                          'inline-block h-4 w-4 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
                          DOT_CLASSES[cell.status],
                          clickable
                            ? 'cursor-pointer hover:ring-2 hover:ring-brand-300'
                            : 'cursor-default',
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Statuses a row can be filtered to: rows with at least one month in that state. */
const ROW_FILTERS = RAG_CELL_STATUSES.filter((status) => status !== 'gray');

function RagMatrixBody() {
  const toast = useToast();
  // The year, a contractor search and a status filter, all in the URL (036 N6, 2026-10-17) —
  // the year always was; the other two are new, and so is a way to clear them. Filtering is
  // done here: the matrix is one request for the whole year either way.
  const [filters, setFilters, query] = useUrlState({
    fy: urlString(financialYearOf()),
    q: urlString(),
    status: urlEnum(['', ...ROW_FILTERS] as const, ''),
  });
  const fy = query.fy;
  const filtered = Boolean(query.q.trim() || query.status);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['partners', 'rag', fy],
    queryFn: () => getRagMatrix(fy),
    placeholderData: keepPreviousData,
  });

  const needle = filters.q.trim().toLowerCase();
  const visible = data && {
    ...data,
    rows: data.rows.filter(
      (row) =>
        (!needle || row.contractorName.toLowerCase().includes(needle)) &&
        (!query.status || row.cells.some((cell) => cell.status === query.status)),
    ),
  };

  // The regulator-facing copy (036 N6): built by the API from the same matrix.
  const download = useMutation({
    mutationFn: () => exportRagMatrix(fy),
    onSuccess: (blob) => saveBlob(blob, `RAG_Matrix_${fy}.xlsx`),
    onError: (err: unknown) =>
      toast.error(errorMessage(err, 'The export could not be prepared.')),
  });

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="RAG matrix"
          description="One financial year of filings for every active contractor. A month that is not yet due is grey rather than red — a filing that is not due has not been missed."
        />
        <Button
          intent="read"
          loading={download.isPending}
          disabled={!data || data.rows.length === 0}
          onClick={() => download.mutate()}
        >
          Export to Excel
        </Button>
      </div>

      <div className="mb-4 grid items-end gap-3 sm:grid-cols-4">
        <Field id="rag-fy" label="Financial year">
          <SelectInput
            id="rag-fy"
            value={filters.fy}
            onChange={(event) => setFilters({ fy: event.target.value })}
          >
            {recentFinancialYears().map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="rag-search" label="Contractor">
          <TextInput
            id="rag-search"
            type="search"
            placeholder="Search by name"
            value={filters.q}
            onChange={(event) => setFilters({ q: event.target.value })}
          />
        </Field>
        <Field id="rag-status" label="Has a month that is">
          <SelectInput
            id="rag-status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ status: event.target.value as typeof filters.status })
            }
          >
            <option value="">Any status</option>
            {ROW_FILTERS.map((value) => (
              <option key={value} value={value}>
                {partnersLabel(value)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div>
          {filtered && (
            <SecondaryButton
              type="button"
              onClick={() => setFilters({ q: '', status: '' })}
            >
              Clear filters
            </SecondaryButton>
          )}
        </div>
      </div>

      {isPending && (
        <div role="status">
          <span className="sr-only">Loading…</span>
          <ListSkeleton headers={['Contractor', ...Array(6).fill('')]} rows={6} />
        </div>
      )}
      {error && !data && <QueryError error={error} onRetry={() => refetch()} />}

      {data && data.rows.length === 0 && (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          No active contractors to report on.
        </p>
      )}

      {visible && data && data.rows.length > 0 && visible.rows.length === 0 && (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          No contractors match these filters.
        </p>
      )}

      {visible && visible.rows.length > 0 && (
        <>
          <RagTable data={visible} />

          <ul className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
            {(Object.keys(DOT_CLASSES) as RagCellStatus[]).map((status) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={clsx(
                    'inline-block h-3 w-3 rounded-full',
                    DOT_CLASSES[status],
                  )}
                />
                {partnersLabel(status)}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

export default function RagMatrixPage() {
  return (
    <Suspense fallback={<ListSkeleton headers={['Contractor']} rows={6} />}>
      <RagMatrixBody />
    </Suspense>
  );
}
