'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { getFunnelReport } from '@/app/lib/api/recruitment';
import { PIPELINE_COLUMNS, recruitmentLabel } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { urlString, useUrlState } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { downloadCsv } from '@/app/ui/recruitment/csv';
import { SecondaryButton, TextField } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

export default function FunnelReportPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-gray-500">
          <LoadingText />
        </p>
      }
    >
      <FunnelReport />
    </Suspense>
  );
}

/**
 * 036 H5: the funnel was all time, with no way to ask about a quarter, nothing on screen when it
 * failed to load, and no way to take it away. The range (inclusive, on the candidate's application
 * date) is optional and kept in the URL; a reversed one is caught here rather than sent for a 400.
 */
function FunnelReport() {
  const [filters, setFilters] = useUrlState({
    from: urlString(),
    to: urlString(),
  });
  const { from, to } = filters;
  const reversed = Boolean(from && to && from > to);

  const report = useQuery({
    queryKey: ['report-funnel', from, to],
    queryFn: () =>
      getFunnelReport({ from: from || undefined, to: to || undefined }),
    enabled: !reversed,
    placeholderData: keepPreviousData,
  });

  const data = report.data;
  const maxCount = data
    ? Math.max(1, ...PIPELINE_COLUMNS.map((s) => data.stageCounts[s] ?? 0))
    : 1;

  const exportCsv = () => {
    if (!data) return;
    const range =
      from || to
        ? `${from ? dateLabel(from) : 'start'} to ${to ? dateLabel(to) : 'today'}`
        : 'All time';
    downloadCsv(
      `recruitment-funnel${from ? `-${from}` : ''}${to ? `-${to}` : ''}.csv`,
      [
        ['Recruitment funnel', range],
        [],
        ['Stage', 'Candidates'],
        ...PIPELINE_COLUMNS.map((stage) => [
          recruitmentLabel(stage),
          data.stageCounts[stage] ?? 0,
        ]),
        [],
        ['From', 'To', 'Conversion %'],
        ...data.conversions.map((c) => [
          recruitmentLabel(c.from),
          recruitmentLabel(c.to),
          c.percent,
        ]),
        [],
        ['Average time to hire (days)', data.averageTimeToHireDays ?? ''],
        [],
        ['Source', 'Candidates'],
        ...data.sourceBreakdown.map((s) => [
          recruitmentLabel(s.source),
          s.count,
        ]),
      ],
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Recruitment Funnel" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <TextField
          id="fn-from"
          label="Applied from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFilters({ from: e.target.value })}
        />
        <TextField
          id="fn-to"
          label="Applied to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setFilters({ to: e.target.value })}
          error={reversed ? 'Must be on or after the from date.' : undefined}
        />
        <div className="flex items-end gap-2 sm:col-span-2">
          {(from || to) && (
            <SecondaryButton onClick={() => setFilters({ from: '', to: '' })}>
              All time
            </SecondaryButton>
          )}
          <Button
            intent="read"
            onClick={exportCsv}
            disabled={!data || reversed || report.isPlaceholderData}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {reversed ? null : report.isPending ? (
        <p className="text-sm text-gray-500">
          <LoadingText />
        </p>
      ) : report.isError ? (
        <QueryError
          error={report.error}
          onRetry={report.refetch}
          fallback="Could not load the funnel."
        />
      ) : null}

      {data && !reversed && (
        <div
          className={`space-y-4 ${report.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <div className="space-y-1">
            {PIPELINE_COLUMNS.map((stage) => {
              const count = data.stageCounts[stage] ?? 0;
              // The single permitted numeric style: the computed bar width.
              const widthPct = `${Math.round((count / maxCount) * 100)}%`;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-gray-600">
                    {recruitmentLabel(stage)}
                  </span>
                  <div className="h-6 flex-1 rounded bg-gray-100">
                    <div
                      className="h-6 rounded bg-brand-400"
                      style={{ width: widthPct }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-medium">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-gray-600">
            Average time to hire:{' '}
            <strong>
              {data.averageTimeToHireDays !== null
                ? `${data.averageTimeToHireDays} days`
                : '—'}
            </strong>
          </p>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">
              Source breakdown
            </h2>
            <ul className="text-sm text-gray-600">
              {data.sourceBreakdown.map((s) => (
                <li key={s.source}>
                  {recruitmentLabel(s.source)}: {s.count}
                </li>
              ))}
              {data.sourceBreakdown.length === 0 && (
                <li className="text-gray-500">
                  {from || to
                    ? 'No candidates applied in this period.'
                    : 'No candidates yet.'}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
