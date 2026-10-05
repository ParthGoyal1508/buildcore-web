'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  type DwrSummary,
  approveDwr,
  listDwrs,
  returnDwr,
  reverseDwr,
  submitDwr,
} from '@/app/lib/api/dwr';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import StatusBadge from '@/app/ui/status-badge';

/**
 * Every daily work report on a project, and what can be done to each (024 Story 1, Story 2).
 *
 * ## The one thing this screen has to get right
 *
 * **Approval is what moves executed quantity** (022 FR-013). A submitted report changes nothing; an
 * approved one increments every line's BOQ figure, all of them or none. So the state of a report is
 * not decoration — it is the difference between work that counts towards a bill and work that does
 * not, and the list leads with it.
 *
 * **The author cannot approve their own report** (022 FR-012a). The button is disabled with the
 * reason on it rather than left enabled to fail: a control that explains itself before being
 * pressed is the difference between a rule and an error message.
 */
export default function DwrPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const {
    data: reports,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dwrs', projectId],
    queryFn: () => listDwrs(projectId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dwrs', projectId] });
    // Approval moved BOQ executed quantities, so anything reading them is now stale. Named
    // individually rather than clearing everything: a blanket reset re-fetches the whole project.
    void queryClient.invalidateQueries({ queryKey: ['boq', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['billPackages', projectId] });
  };

  const act = useMutation({
    mutationFn: async (job: {
      kind: 'submit' | 'approve' | 'return' | 'reverse';
      dwrId: string;
      reason?: string;
    }) => {
      if (job.kind === 'submit') return submitDwr(job.dwrId);
      if (job.kind === 'approve') return approveDwr(job.dwrId);
      if (job.kind === 'return')
        return returnDwr(job.dwrId, job.reason ?? '');
      return reverseDwr(job.dwrId, job.reason ?? '');
    },
    onSuccess: (_result, job) => {
      setError(null);
      setNotice(
        job.kind === 'approve'
          ? 'Approved. The executed quantity on each BOQ line has moved.'
          : job.kind === 'reverse'
            ? 'Reversed. Exactly what the approval added has been taken back.'
            : job.kind === 'submit'
              ? 'Submitted for approval. Nothing has moved yet — approval is what does that.'
              : 'Returned to the author.',
      );
      refresh();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(describe(err));
    },
  });

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading daily work reports…
      </p>
    );
  }
  if (isError) {
    return (
      <p className="p-4 text-sm text-red-700" role="alert">
        Could not load the daily work reports.
      </p>
    );
  }

  const rows = reports ?? [];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Daily work reports
          </h2>
          <p className="text-sm text-gray-600">
            What was done on site each day. Approval is what moves executed
            quantity onto the BOQ — a submitted report counts for nothing until
            somebody else approves it.
          </p>
        </div>
        <Link href={ROUTES.projectsDwrNew(projectId)}>
          <Button>Record a day</Button>
        </Link>
      </header>

      {notice && (
        <p
          className="rounded-md bg-green-50 p-3 text-sm text-green-800"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          No day has been recorded on this project yet. Until one is, every BOQ
          line reads nought per cent complete and a bill composed from it would
          claim nothing.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Report</th>
                <th className="px-3 py-2">Work date</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2">On site</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((report) => (
                <ReportRow
                  key={report.id}
                  projectId={projectId}
                  report={report}
                  currentUserId={user?.id}
                  busy={act.isPending}
                  onAct={(kind, reason) =>
                    act.mutate({ kind, dwrId: report.id, reason })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReportRow({
  projectId,
  report,
  currentUserId,
  busy,
  onAct,
}: {
  projectId: string;
  report: DwrSummary;
  currentUserId: string | undefined;
  busy: boolean;
  onAct: (
    kind: 'submit' | 'approve' | 'return' | 'reverse',
    reason?: string,
  ) => void;
}) {
  const reversed = Boolean(report.reversedAt);

  // 022 FR-012a. The author of a report may not approve it, so the control says why instead of
  // offering an action that will be refused.
  const isAuthor =
    Boolean(currentUserId) &&
    (report.createdByUserId === currentUserId ||
      report.submittedByUserId === currentUserId);

  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <Link
          href={ROUTES.projectsDwrReport(projectId, report.id)}
          className="font-medium text-blue-700 hover:underline"
        >
          {report.dprNumber}
        </Link>
      </td>
      <td className="px-3 py-2">{dateLabel(report.workDate)}</td>
      <td className="px-3 py-2">
        <StatusBadge status={reversed ? 'returned' : report.status} />
        {reversed && (
          <span className="ml-2 text-xs text-gray-500">reversed</span>
        )}
      </td>
      {/* A count, because the list is a page of summaries: `lineCount` is what the server sends and
          the lines themselves are on the detail read. This column rendered an array the list has
          never carried, so it read "none" for every report whatever the day contained. */}
      <td className="px-3 py-2 text-right tabular-nums">
        {report.lineCount === 0 ? (
          <span className="text-gray-500">none</span>
        ) : (
          report.lineCount
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-gray-600">
        {report.workerCount ?? 0} people · {report.machineryCount ?? 0} machines
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap justify-end gap-2">
          {report.status === 'draft' || report.status === 'returned' ? (
            <Button disabled={busy} onClick={() => onAct('submit')}>
              Submit
            </Button>
          ) : null}

          {report.status === 'submitted' && (
            <>
              <Button
                disabled={busy || isAuthor}
                title={
                  isAuthor
                    ? 'You recorded this report, so somebody else has to approve it.'
                    : undefined
                }
                onClick={() => onAct('approve')}
              >
                Approve
              </Button>
              <Button
                disabled={busy}
                intent="write"
                onClick={() => {
                  const reason = window.prompt(
                    'Why is this going back to the author?',
                  );
                  if (reason) onAct('return', reason);
                }}
              >
                Return
              </Button>
            </>
          )}

          {report.status === 'approved' && !reversed && (
            <Button
              disabled={busy}
              onClick={() => {
                const reason = window.prompt(
                  'Why is this approval being reversed? The quantity it added will be taken back.',
                );
                if (reason) onAct('reverse', reason);
              }}
            >
              Reverse
            </Button>
          )}
        </div>
        {isAuthor && report.status === 'submitted' && (
          <p className="mt-1 text-right text-xs text-gray-500">
            You recorded this one.
          </p>
        )}
      </td>
    </tr>
  );
}

/**
 * The server's own message, where it sent one.
 *
 * 022 and 023 name every refusal and say what to do about it — "this project is locked", "these
 * lines have no rate", "the author cannot approve their own report". Replacing that with "something
 * went wrong" throws away the only part of the response that helps.
 *
 * **A 423 is not a permission problem** (024 FR-010): the same person may write the moment the
 * project is unlocked, so it says so rather than reading as access denied.
 */
function describe(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string };
  };
  if (anyErr?.status === 423) {
    return 'This project is locked, so nothing can be written to it. Unlock it and try again — this is not a permission problem.';
  }
  if (anyErr?.status === 404) {
    return 'Not found. It may belong to another company, or have been removed.';
  }
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'The request was refused and the server gave no reason.'
  );
}
