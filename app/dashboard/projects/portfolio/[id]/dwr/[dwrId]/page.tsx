'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { getDwr, quantityOf } from '@/app/lib/api/dwr';
import DwrAttachments from '@/app/ui/projects/dwr-attachments';
import { dateLabel, dateTimeLabel } from '@/app/lib/format';
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
  const params = useParams<{ dwrId: string }>();
  const { data: report, isLoading } = useQuery({
    queryKey: ['dwr', params.dwrId],
    queryFn: () => getDwr(params.dwrId),
  });

  if (isLoading || !report) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading the report…
      </p>
    );
  }

  const lines = report.tasks ?? report.lines ?? [];

  return (
    <SectionGuard permission="DWR">
      <div className="flex flex-col gap-6">
        <header>
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
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
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
                            {[
                              ['length', line.length],
                              ['breadth', line.breadth],
                              ['depth', line.depth],
                              ['density', line.density],
                            ]
                              .filter(([, value]) => value)
                              .map(([label, value]) => `${label} ${value}`)
                              .join(' × ') || 'no factors entered'}
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
