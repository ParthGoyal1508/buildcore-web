'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import clsx from 'clsx';

import { getRagMatrix } from '@/app/lib/api/partners';
import { MESSAGES, ROUTES, partnersLabel, type RagCellStatus } from '@/app/lib/constants';
import { financialYearOf, periodLabel } from '@/app/lib/format';
import { lusitana } from '@/app/ui/fonts';
import { Field, SelectInput } from '@/app/ui/partners/form-controls';

/** Dot colours. Distinct from `StatusBadge` because a dot has no text to carry the
 * meaning, so each one gets a `title` and an accessible label instead. */
const DOT_CLASSES: Record<RagCellStatus, string> = {
  verified: 'bg-green-600',
  submitted: 'bg-blue-500',
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

function RagMatrixBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fy = searchParams.get('fy') ?? financialYearOf();

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'rag', fy],
    queryFn: () => getRagMatrix(fy),
  });

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} mb-2 text-2xl`}>RAG matrix</h1>
          <p className="max-w-2xl text-sm text-gray-600">
            One financial year of filings for every active contractor. A month that
            is not yet due is grey rather than red — a filing that is not due has not
            been missed.
          </p>
        </div>
        <div className="w-48">
          <Field id="rag-fy" label="Financial year">
            <SelectInput
              id="rag-fy"
              value={fy}
              onChange={(event) =>
                // The year goes in the URL so the view is linkable and survives a
                // reload — a component-state selector would lose it on both.
                router.push(`${ROUTES.partnersRag}?fy=${event.target.value}`)
              }
            >
              {recentFinancialYears().map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>

      {isPending && (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500" role="status">
          Loading…
        </p>
      )}
      {isError && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}

      {data && data.rows.length === 0 && (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          No active contractors to report on.
        </p>
      )}

      {data && data.rows.length > 0 && (
        <>
          {/* The overflow lives on this container, so the page body never scrolls
              sideways however many months are shown (Principle VI). */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-max border-collapse text-sm">
              <caption className="sr-only">
                Monthly PF and ESIC compliance for {data.fy}
              </caption>
              <thead>
                <tr className="bg-gray-50">
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700"
                  >
                    Contractor
                  </th>
                  {data.months.map((month) => (
                    <th
                      key={month}
                      scope="col"
                      className="px-3 py-2 text-center font-medium text-gray-700"
                    >
                      {periodLabel(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.contractorProfileId} className="border-t border-gray-100">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-gray-900"
                    >
                      {row.contractorName}
                    </th>
                    {row.cells.map((cell) => {
                      const label = `${row.contractorName}, ${periodLabel(cell.month)}: ${partnersLabel(cell.status)}`;
                      const clickable = cell.status !== 'gray';
                      return (
                        <td key={cell.month} className="px-3 py-2 text-center">
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
                              'inline-block h-4 w-4 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                              DOT_CLASSES[cell.status],
                              clickable
                                ? 'cursor-pointer hover:ring-2 hover:ring-blue-300'
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

          <ul className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
            {(Object.keys(DOT_CLASSES) as RagCellStatus[]).map((status) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={clsx('inline-block h-3 w-3 rounded-full', DOT_CLASSES[status])}
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
    <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
      <RagMatrixBody />
    </Suspense>
  );
}
