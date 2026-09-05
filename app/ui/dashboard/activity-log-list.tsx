'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  exportActivityLog,
  getActivityLog,
  triggerDownload,
  type ActivityLogEntry,
} from '@/app/lib/api/dashboard';
import {
  ACTIVITY_MODULES,
  ACTIVITY_TIME_RANGES,
} from '@/app/lib/constants';
import ResponsiveList, {
  type Column,
} from '@/app/ui/settings/responsive-list';

const selectClass =
  'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function ActivityLogList() {
  const [module, setModule] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: ['activity-log', module, timeRange, page],
    queryFn: () =>
      getActivityLog({
        module: module || undefined,
        timeRange: timeRange || undefined,
        page,
      }),
  });

  const download = useMutation({
    mutationFn: async () => {
      const blob = await exportActivityLog({
        module: module || undefined,
        timeRange: timeRange || undefined,
      });
      triggerDownload(blob, 'activity-log.csv');
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not export.'),
  });

  const resetPage = () => setPage(1);

  const columns: Column<ActivityLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'When',
      render: (e) => new Date(e.timestamp).toLocaleString(),
    },
    { key: 'actor', header: 'User', render: (e) => e.actor },
    { key: 'action', header: 'Action', render: (e) => e.action },
    { key: 'module', header: 'Module', render: (e) => e.module },
    { key: 'target', header: 'Target', render: (e) => e.target ?? '—' },
  ];

  const emptyMessage =
    module || timeRange
      ? 'No activity matches these filters.'
      : 'No activity recorded yet.';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Module</span>
          <select
            className={selectClass}
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              resetPage();
            }}
          >
            <option value="">All modules</option>
            {ACTIVITY_MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Time range</span>
          <select
            className={selectClass}
            value={timeRange}
            onChange={(e) => {
              setTimeRange(e.target.value);
              resetPage();
            }}
          >
            <option value="">All time</option>
            {ACTIVITY_TIME_RANGES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => download.mutate()}
          disabled={download.isPending}
          className="ml-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {download.isPending ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={feed.data?.entries ?? []}
        rowKey={(e) => e.id}
        emptyMessage={emptyMessage}
        isLoading={feed.isPending}
        error={feed.isError ? 'Could not load the activity log.' : null}
      />

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!feed.data?.hasMore}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
