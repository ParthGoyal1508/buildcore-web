'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadExport,
  exportReport,
  getExportStatus,
  getReportTypes,
  runReport,
  triggerDownload,
  type ReportData,
  type ReportResult,
  type ReportType,
} from '@/app/lib/api/dashboard';
import FilterField from '@/app/ui/dashboard/filter-field';
import ReportResultTable from '@/app/ui/dashboard/report-result-table';
import ReportTypeList from '@/app/ui/dashboard/report-type-list';

function buildBody(values: Record<string, string>) {
  const { fromDate, toDate, ...rest } = values;
  const filters = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== ''),
  );
  return {
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

const extFor = (format: 'pdf' | 'excel') => (format === 'pdf' ? 'pdf' : 'xlsx');

export default function ReportsPage() {
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const types = useQuery({ queryKey: ['report-types'], queryFn: getReportTypes });

  function pick(type: ReportType) {
    setSelected(type);
    setValues({});
    setResult(null);
    setJobId(null);
    setMessage(null);
    setError(null);
  }

  const run = useMutation({
    mutationFn: () => runReport(selected!.id, buildBody(values)),
    onSuccess: (res) => {
      setResult(res);
      setError(null);
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not run the report.'),
  });

  const exportMut = useMutation({
    mutationFn: () =>
      exportReport(selected!.id, { ...buildBody(values), format }),
    onSuccess: (outcome) => {
      setError(null);
      if (outcome.mode === 'sync') {
        triggerDownload(outcome.blob, `${selected!.id}.${extFor(format)}`);
        setMessage('Download started.');
      } else if (outcome.mode === 'async') {
        setJobId(outcome.exportJobId);
        setMessage('Preparing a large export…');
      } else {
        setMessage(`Not available — waiting on the ${outcome.module} module.`);
      }
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not export.'),
  });

  const jobStatus = useQuery({
    queryKey: ['export-status', jobId],
    queryFn: () => getExportStatus(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'ready' || status === 'failed' ? false : 2000;
    },
  });

  useEffect(() => {
    const status = jobStatus.data?.status;
    if (!jobId || (status !== 'ready' && status !== 'failed')) return;
    let cancelled = false;
    // All state changes happen inside this async task, never synchronously in the
    // effect body — the download has to await the file either way.
    void (async () => {
      if (status === 'ready') {
        try {
          const blob = await downloadExport(jobId);
          if (cancelled) return;
          triggerDownload(blob, `${selected?.id ?? 'report'}.${extFor(format)}`);
          setMessage('Export ready — download started.');
        } catch {
          if (!cancelled) setError('Could not download the finished export.');
        }
      } else if (!cancelled) {
        setError(jobStatus.data?.failureReason ?? 'Export failed.');
      }
      if (!cancelled) setJobId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, jobStatus.data, selected, format]);

  const isUnavailableResult =
    result !== null && 'unavailable' in result ? result : null;
  const dataResult: ReportData | null =
    result !== null && !('unavailable' in result) ? result : null;

  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">
          Reports
        </h1>
        <p className="text-sm text-gray-500">
          Run a report, then export it to PDF or Excel.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {types.isPending && (
            <p className="text-sm text-gray-500" role="status">
              Loading report types…
            </p>
          )}
          {types.isError && (
            <p className="text-sm text-red-600" role="alert">
              Could not load report types.
            </p>
          )}
          {types.data && (
            <ReportTypeList
              types={types.data}
              selectedId={selected?.id ?? null}
              onSelect={pick}
            />
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected && (
            <p className="text-sm text-gray-500">
              Select a report type to begin.
            </p>
          )}

          {selected && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.filters.map((spec) => (
                  <FilterField
                    key={spec.key}
                    spec={spec}
                    value={values[spec.key] ?? ''}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [spec.key]: v }))
                    }
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => run.mutate()}
                  disabled={run.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {run.isPending ? 'Running…' : 'Run report'}
                </button>

                <label className="text-sm">
                  <span className="sr-only">Export format</span>
                  <select
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={format}
                    onChange={(e) =>
                      setFormat(e.target.value as 'pdf' | 'excel')
                    }
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </label>

                <button
                  onClick={() => exportMut.mutate()}
                  disabled={exportMut.isPending || jobId !== null}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {jobId !== null
                    ? 'Processing…'
                    : exportMut.isPending
                      ? 'Exporting…'
                      : 'Export'}
                </button>
              </div>

              {message && (
                <p className="text-sm text-gray-600" role="status">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              {isUnavailableResult && (
                <p className="text-sm text-gray-500">
                  This report is not available yet — waiting on the{' '}
                  {isUnavailableResult.unavailable.module} module.
                </p>
              )}

              {dataResult && <ReportResultTable data={dataResult} />}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
