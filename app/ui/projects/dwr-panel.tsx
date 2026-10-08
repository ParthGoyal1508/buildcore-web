'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  type DwrSummary,
  approveDwr,
  deleteDwr,
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

  /**
   * Whether this caller may approve a report they submitted (025 FR-040).
   *
   * Keyed to the permission the API keys it to, never to the role name "Super Admin" — a role is
   * data an administrator renames, and a capability keyed to a display string disappears the day
   * they do, silently and with no error anywhere.
   */
  const mayApproveOwn = Boolean(
    user?.permissions.includes('CROSS_COMPANY_ACCESS'),
  );

  const {
    data: reports,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dwrs', projectId],
    queryFn: () => listDwrs(projectId),
  });

  // Defaulted to the order the server already returns, so the first paint does not reshuffle
  // under the reader: `workDate desc`, with the report number breaking ties.
  const [sort, setSort] = useState<Sort>({
    column: 'workDate',
    direction: 'desc',
  });

  const rows = useSorted(reports ?? [], sort);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dwrs', projectId] });
    // Approval moved BOQ executed quantities, so anything reading them is now stale. Named
    // individually rather than clearing everything: a blanket reset re-fetches the whole project.
    void queryClient.invalidateQueries({ queryKey: ['boq', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['billPackages', projectId] });
  };

  const act = useMutation({
    mutationFn: async (job: {
      kind: 'submit' | 'approve' | 'return' | 'reverse' | 'delete';
      dwrId: string;
      reason?: string;
    }) => {
      if (job.kind === 'submit') return submitDwr(job.dwrId);
      // Only a draft; the server refuses anything else by name, naming the reversal path for an
      // approved report rather than letting a day's record be deleted out from under a bill.
      if (job.kind === 'delete') return deleteDwr(job.dwrId);
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
          : job.kind === 'delete'
            ? 'Deleted. Nothing had moved, because only a draft can be.'
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
                <SortableHeader
                  label="Report"
                  column="dprNumber"
                  sort={sort}
                  onSort={setSort}
                />
                <SortableHeader
                  label="Work date"
                  column="workDate"
                  sort={sort}
                  onSort={setSort}
                />
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
                  mayApproveOwn={mayApproveOwn}
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

/** Which column the list is ordered by, and which way. */
interface Sort {
  column: 'dprNumber' | 'workDate';
  direction: 'asc' | 'desc';
}

/**
 * The list in the reader's chosen order — **a copy, sorted here rather than refetched**.
 *
 * The server already returns every report on the project in one response, so ordering is a
 * question the page can answer by itself; asking the API to re-sort would be a round trip to
 * rearrange rows the browser is holding. `toSorted` is avoided for the same reason the rest of
 * this codebase avoids it — `reports` is TanStack Query's cached array, and sorting it in place
 * would mutate the cache.
 */
function useSorted(reports: DwrSummary[], sort: Sort): DwrSummary[] {
  return useMemo(() => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...reports].sort((a, b) => {
      // Numeric collation, not plain text. The numbers are zero-padded today so the two agree,
      // and a project that ever reaches DPR-10000 would otherwise sort it between 0001 and 0002.
      const primary =
        sort.column === 'dprNumber'
          ? a.dprNumber.localeCompare(b.dprNumber, undefined, { numeric: true })
          : a.workDate.localeCompare(b.workDate);
      // Two reports on one day is ordinary — there are four such pairs on the project this was
      // reported from. Without a tiebreak those rows would reorder arbitrarily between renders.
      const tiebreak = a.dprNumber.localeCompare(b.dprNumber, undefined, {
        numeric: true,
      });
      return sign * (primary || tiebreak);
    });
  }, [reports, sort]);
}

/**
 * A column header that sorts, announcing its state to a screen reader through `aria-sort`.
 *
 * Clicking the column already sorted reverses it; clicking another takes that column descending,
 * which is what a reader of a dated list wants first — the most recent day, not the oldest.
 */
function SortableHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: Sort['column'];
  sort: Sort;
  onSort: (next: Sort) => void;
}) {
  const active = sort.column === column;
  return (
    <th
      className="px-3 py-2"
      aria-sort={
        active
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase tracking-wide text-gray-500 hover:text-gray-900"
        onClick={() =>
          onSort({
            column,
            direction: active && sort.direction === 'desc' ? 'asc' : 'desc',
          })
        }
      >
        {label}
        <span aria-hidden className={active ? 'text-gray-900' : 'text-gray-300'}>
          {active && sort.direction === 'asc' ? '\u2191' : '\u2193'}
        </span>
      </button>
    </th>
  );
}

function ReportRow({
  projectId,
  report,
  currentUserId,
  busy,
  mayApproveOwn,
  onAct,
}: {
  mayApproveOwn: boolean;
  projectId: string;
  report: DwrSummary;
  currentUserId: string | undefined;
  busy: boolean;
  onAct: (
    kind: 'submit' | 'approve' | 'return' | 'reverse' | 'delete',
    reason?: string,
  ) => void;
}) {
  const reversed = Boolean(report.reversedAt);

  // 022 FR-012a. The author of a report may not approve it, so the control says why instead of
  // offering an action that will be refused.
  //
  // **`submittedByUserId` alone, matching the server.** This also tested `createdByUserId`, which
  // made the button stricter than the rule: a report you typed and somebody else put forward is one
  // the API would let you approve, and the screen disabled it anyway. Failing safe, but a control
  // that refuses what the server permits teaches people the screen is wrong rather than the rule.
  const isAuthor =
    Boolean(currentUserId) && report.submittedByUserId === currentUserId;

  // 025 FR-040. A caller holding the cross-company permission may approve their own report.
  const blockedAsAuthor = isAuthor && !mayApproveOwn;

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
        {/* The report's own status, and a marker beside it where an approval was taken back.
            This read `reversed ? 'returned' : report.status`, which was a stand-in from when the
            server had no `returned` value to send: a reversed report sits in `draft`, and showing
            it as "Returned" said a reviewer had sent it back when nobody had. Now that a return
            is a status of its own (028), the two cannot share one badge. */}
        <StatusBadge status={report.status} />
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
            <>
              <Button disabled={busy} onClick={() => onAct('submit')}>
                Submit
              </Button>
              {/* 025 FR-026. A draft entered against the wrong project or the wrong day had no way
                  out: the endpoint has existed since 022 and nothing called it. */}
              <Button
                disabled={busy}
                intent="write"
                onClick={() => {
                  if (
                    window.confirm(
                      'Delete this draft? Nothing has moved yet, so nothing is taken back.',
                    )
                  ) {
                    onAct('delete');
                  }
                }}
              >
                Delete
              </Button>
            </>
          ) : null}

          {report.status === 'submitted' && (
            <>
              <Button
                disabled={busy || blockedAsAuthor}
                title={
                  blockedAsAuthor
                    ? 'You submitted this report, so somebody else has to approve it.'
                    : isAuthor
                      ? 'You submitted this report. Your permissions let you approve it anyway, and the approval is recorded as one you made yourself.'
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
            {blockedAsAuthor
              ? 'You submitted this one.'
              : 'You submitted this one — approving it is recorded as such.'}
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
