'use client';

import { useQuery } from '@tanstack/react-query';

import { getFunnelReport } from '@/app/lib/api/recruitment';
import { PIPELINE_COLUMNS, recruitmentLabel } from '@/app/lib/constants';

export default function FunnelReportPage() {
  const report = useQuery({ queryKey: ['report-funnel'], queryFn: () => getFunnelReport() });

  const data = report.data;
  const maxCount = data
    ? Math.max(1, ...PIPELINE_COLUMNS.map((s) => data.stageCounts[s] ?? 0))
    : 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Recruitment Funnel</h1>

      {report.isPending && <p className="text-sm text-gray-500">Loading…</p>}

      {data && (
        <>
          <div className="space-y-1">
            {PIPELINE_COLUMNS.map((stage) => {
              const count = data.stageCounts[stage] ?? 0;
              // The single permitted numeric style: the computed bar width.
              const widthPct = `${Math.round((count / maxCount) * 100)}%`;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-gray-600">{recruitmentLabel(stage)}</span>
                  <div className="h-6 flex-1 rounded bg-gray-100">
                    <div className="h-6 rounded bg-blue-400" style={{ width: widthPct }} />
                  </div>
                  <span className="w-10 text-right text-sm font-medium">{count}</span>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-gray-600">
            Average time to hire:{' '}
            <strong>{data.averageTimeToHireDays !== null ? `${data.averageTimeToHireDays} days` : '—'}</strong>
          </p>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Source breakdown</h2>
            <ul className="text-sm text-gray-600">
              {data.sourceBreakdown.map((s) => (
                <li key={s.source}>
                  {recruitmentLabel(s.source)}: {s.count}
                </li>
              ))}
              {data.sourceBreakdown.length === 0 && <li className="text-gray-400">No candidates yet.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
