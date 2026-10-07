'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { saveBlob } from '@/app/lib/api/hr-payroll';
import {
  deleteDwr,
  describeDwrError,
  downloadDwrReport,
  factorsOf,
  getDwr,
  quantityOf,
} from '@/app/lib/api/dwr';
import { ROUTES } from '@/app/lib/constants';
import DwrAttachments from '@/app/ui/projects/dwr-attachments';
import { dateLabel, dateTimeLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import SectionGuard from '@/app/ui/projects/section-guard';
import StatusBadge from '@/app/ui/status-badge';

/**
 * One daily work report, read-only (024 Story 2).
 *
 * The actions live on the list, where somebody working through a day's reports can submit or
 * approve several without navigating between them. This screen is what a reviewer opens to see
 * **how** a quantity was arrived at — the dimensions behind a measured line, the day served and its
 * remark behind a presence one.
 *
 * A measured line shows its factors and its product. That is the only place in the product where
 * the two appear together, and it is what makes the computed quantity checkable rather than
 * trusted: an omitted factor counts as one, so 100 × 7.5 × 0.15 with three blanks is 112.5.
 */
export default function DwrReportPage() {
  const params = useParams<{ id: string; dwrId: string }>();
  const projectId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ['dwr', params.dwrId],
    queryFn: () => getDwr(params.dwrId),
  });

  /**
   * The printable form (028 FR-022).
   *
   * Offered on every status, not only on an approved report. A draft downloads and says DRAFT on
   * its face — which is what somebody checking their figures before submitting actually wants, and
   * more honest than a clean-looking form for a report nobody has put forward.
   */
  const form = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await downloadDwrReport(
        params.dwrId,
        report?.dprNumber ?? 'report',
      );
      saveBlob(blob, filename);
    },
    onError: (err: unknown) => setError(describeDwrError(err)),
  });

  const remove = useMutation({
    mutationFn: () => deleteDwr(params.dwrId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dwr'] });
      router.push(ROUTES.projectsDwr(projectId));
    },
    onError: (err: unknown) => setError(describeDwrError(err)),
  });

  if (isLoading || !report) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading the report…
      </p>
    );
  }

  // `lines`, and only `lines`. The read briefly answered with a `tasks` array too — the raw rows,
  // carrying the BOQ line nested and no flat `boqNo` — and preferring it here is why every line on
  // this screen read "BOQ —". The server no longer sends it; the fallback would re-create the bug.
  const lines = report.lines ?? [];

  return (
    <SectionGuard permission="DWR">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900">
              {report.dprNumber}
              <StatusBadge status={report.status} />
            </h2>
            <p className="text-sm text-gray-600">
              {dateLabel(report.workDate)} · {report.workerCount ?? 0} people ·{' '}
              {report.machineryCount ?? 0} machines
              {report.weather ? ` · ${report.weather}` : ''}
            </p>
            {report.description && (
              <p className="mt-2 text-sm text-gray-700">{report.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Every status, deliberately. A draft downloads and says DRAFT on its face, which is
                what somebody checking their figures before submitting wants — and more honest than
                a clean-looking form for a report nobody has put forward. */}
            <Button
              type="button"
              disabled={form.isPending}
              onClick={() => {
                setError(null);
                form.mutate();
              }}
            >
              {form.isPending ? 'Preparing…' : 'Download the form'}
            </Button>

            {/* Draft only. A submitted report is a claim somebody is reading and an approved one
                has already moved quantities a bill may rest on — the routes back are return and
                reverse, which the panel offers. Offering Edit on either would promise something
                the server refuses by status. */}
            {report.status === 'draft' && (
              <>
                <Link
                  href={ROUTES.projectsDwrEdit(projectId, report.id)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </Link>
                <Button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => {
                    setError(null);
                    remove.mutate();
                  }}
                >
                  {remove.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </>
            )}
          </div>
        </header>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {/* FR-024, and both of them. The ids have been on this response since 025 and name
              nobody; on a report returned for correction the person who recorded it and the
              person who submitted it are different people, and the second is usually the one who
              has to answer for a figure. */}
          <div>
            <dt className="text-gray-500">Recorded by</dt>
            <dd>{report.recordedByName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Submitted by</dt>
            <dd>{report.submittedByName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Submitted</dt>
            <dd>{dateTimeLabel(report.submittedAt) || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Approved</dt>
            <dd>{dateTimeLabel(report.approvedAt) || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Reversed</dt>
            <dd>
              {report.reversedAt
                ? `${dateTimeLabel(report.reversedAt)} — ${report.reversalReason ?? ''}`
                : '—'}
            </dd>
          </div>
        </dl>

        {report.status !== 'approved' && (
          <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            This report has not been approved, so none of the quantities below
            has moved onto the BOQ. Approval is what does that.
          </p>
        )}

        <section>
          <h3 className="mb-2 font-medium text-gray-900">
            Lines ({lines.length})
          </h3>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-600">
              No lines. A day with nothing measured is still a day that
              happened.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">BOQ</th>
                    <th className="px-3 py-2">Basis</th>
                    <th className="px-3 py-2">How it was measured</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {line.boqNo ?? '—'}
                        {line.taskName && (
                          <span className="block text-xs text-gray-500">
                            {line.taskName}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {line.paymentMode === 'work_basis'
                          ? 'measured'
                          : 'presence'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {line.paymentMode === 'work_basis' ? (
                          <>
                            {/* All six, in the order the server multiplies them. Four were
                                listed here and `nos1`/`nos2` were not, so a line measured
                                2 × 6 × 2 × 1 would have shown the 6, the 2 and the 1 and
                                silently dropped the ×2 — a quantity that cannot be checked
                                against the factors beside it. */}
                            {factorsOf(line)
                              .map(([label, value]) => `${label} ${value}`)
                              .join(' × ') || 'nothing entered — counted as one'}
                            <span className="block text-gray-400">
                              a blank factor counts as one
                            </span>
                          </>
                        ) : (
                          'the day served'
                        )}
                      </td>
                      {/* One helper decides how a quantity reads, so the two line kinds cannot be
                          shown differently on two screens. A dash where neither column holds a
                          figure: a zero would claim a measurement that does not exist. */}
                      <td className="px-3 py-2 text-right font-medium">
                        {quantityOf(line) ?? '—'}{' '}
                        <span className="text-xs font-normal text-gray-500">
                          {line.unit ?? ''}
                        </span>
                      </td>
                      <td className="max-w-sm px-3 py-2 text-xs text-gray-700">
                        {line.remark ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <DwrAttachments
          dwrId={params.dwrId}
          attachments={report.attachments ?? []}
        />
      </div>
    </SectionGuard>
  );
}
