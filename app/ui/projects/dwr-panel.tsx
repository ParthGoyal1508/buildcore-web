'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import {
  DWR_PAGE_SIZE,
  DWR_STATUSES,
  type DwrStatus,
  type DwrSummary,
  approveDwr,
  deleteDwr,
  listDwrPage,
  returnDwr,
  reverseDwr,
  submitDwr,
} from '@/app/lib/api/dwr';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import Pager from '@/app/ui/inventory/pager';
import { useProjectLock } from '@/app/ui/projects/project-lock-context';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';
import { TABLE } from '@/app/ui/table';
import { useToast } from '@/app/ui/toast';
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';
import { boqKeys } from '@/app/lib/api/projects';

const STATUS_FILTERS = ['all', ...DWR_STATUSES] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All states',
  draft: 'Draft',
  submitted: 'Submitted',
  returned: 'Returned',
  approved: 'Approved',
};

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
  const toast = useToast();
  const { isLocked } = useProjectLock();
  const [error, setError] = useState<string | null>(null);

  // 036 I6: the filters and the page live in the URL, so Back from a report returns to the same
  // page of the same filter, and a filtered list can be sent as a link.
  const [filters, setFilters, query] = useUrlState(
    {
      status: urlEnum(STATUS_FILTERS, 'all'),
      from: urlString(),
      to: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );

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

  // 036 I6: one page at a time, with the total. Unpaged, the API's default of 25 applied and every
  // older report silently did not exist here. Under `['dwrs', projectId, …]`, so the existing
  // invalidations of `['dwrs', projectId]` still refresh every page and filter.
  const list = useQuery({
    queryKey: ['dwrs', projectId, query],
    queryFn: () =>
      listDwrPage({
        projectId,
        status: query.status === 'all' ? undefined : (query.status as DwrStatus),
        from: query.from || undefined,
        to: query.to || undefined,
        page: query.page,
        pageSize: DWR_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  // The server's order — work date newest first, report number breaking ties. No column sorting:
  // sorting one page of many would present a page's order as the list's (036 I6).
  const rows = list.data?.items ?? [];
  const filtered =
    query.status !== 'all' || query.from !== '' || query.to !== '';

  /** Resolves once the list has been re-read, so a notice can wait for the row it describes. */
  const refresh = () => {
    // Approval moved BOQ executed quantities, so anything reading them is now stale. Named
    // individually rather than clearing everything: a blanket reset re-fetches the whole project.
    void queryClient.invalidateQueries({ queryKey: boqKeys.project(projectId) });
    void queryClient.invalidateQueries({
      queryKey: ['billPackages', projectId],
    });
    return queryClient.invalidateQueries({ queryKey: ['dwrs', projectId] });
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
      if (job.kind === 'return') return returnDwr(job.dwrId, job.reason ?? '');
      return reverseDwr(job.dwrId, job.reason ?? '');
    },
    // Awaits the list before saying anything: "Submitted for approval" over a row still reading
    // Draft is two answers to one question. The mutation stays pending meanwhile, so its buttons
    // stay disabled until the row and the notice agree.
    onSuccess: async (_result, job) => {
      await refresh();
      setError(null);
      toast.success(
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
    },
    onError: (err: unknown) => {
      setError(describe(err));
    },
  });

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
        {/* Hidden on a locked project, as the BOQ entry is: a greyed button invites a click and
            then a 423. The layout's banner says the project is locked. */}
        {!isLocked && (
          <Link href={ROUTES.projectsDwrNew(projectId)}>
            <Button>Record a day</Button>
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          State
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ status: e.target.value as StatusFilter })
            }
            className="h-10 rounded-md border border-gray-300 px-2 text-sm"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Work date from
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters({ from: e.target.value })}
            className="h-10 rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          to
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters({ to: e.target.value })}
            className="h-10 rounded-md border border-gray-300 px-2 text-sm"
          />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => setFilters({ status: 'all', from: '', to: '' })}
            className="h-10 rounded-md px-3 text-sm font-medium text-blue-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {list.isLoading ? (
        <ListSkeleton
          headers={DWR_COLUMNS.map((column) => column.label)}
          actions={!isLocked}
        />
      ) : list.isError ? (
        <QueryError
          error={list.error}
          onRetry={list.refetch}
          fallback="The daily work reports could not be loaded."
        />
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          {filtered
            ? 'No report matches these filters.'
            : 'No day has been recorded on this project yet. Until one is, every BOQ line reads nought per cent complete and a bill composed from it would claim nothing.'}
        </p>
      ) : (
        <>
          <div
            className={clsx(
              TABLE.wrap,
              list.isPlaceholderData && 'opacity-60 transition-opacity',
            )}
            aria-busy={list.isFetching || undefined}
          >
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
                <tr>
                  {DWR_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={clsx(TABLE.th, column.numeric && 'text-right')}
                    >
                      {column.label}
                    </th>
                  ))}
                  {!isLocked && (
                    <th className={clsx(TABLE.th, 'text-right')}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((report) => (
                  <ReportRow
                    key={report.id}
                    projectId={projectId}
                    report={report}
                    currentUserId={user?.id}
                    busy={act.isPending}
                    pendingKind={
                      act.isPending && act.variables?.dwrId === report.id
                        ? act.variables.kind
                        : null
                    }
                    readOnly={isLocked}
                    mayApproveOwn={mayApproveOwn}
                    onAct={(kind, reason) =>
                      act.mutate({ kind, dwrId: report.id, reason })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          {list.data && (
            <Pager
              total={list.data.total}
              page={list.data.page}
              pageSize={list.data.pageSize}
              onPageChange={(page) => setFilters({ page })}
              noun="report"
            />
          )}
        </>
      )}
    </section>
  );
}

// The columns. Sortable until 036 I6; the list is now one page of many, and sorting a page would
// present one page's order as the whole list's, so the server's order (newest day first) stands.
const DWR_COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: 'dprNumber', label: 'Report' },
  { key: 'workDate', label: 'Work date' },
  { key: 'status', label: 'State' },
  { key: 'lineCount', label: 'Lines', numeric: true },
  { key: 'onSite', label: 'On site' },
];

type DwrAction = 'submit' | 'approve' | 'return' | 'reverse' | 'delete';

function ReportRow({
  projectId,
  report,
  currentUserId,
  busy,
  pendingKind,
  readOnly,
  mayApproveOwn,
  onAct,
}: {
  mayApproveOwn: boolean;
  projectId: string;
  report: DwrSummary;
  currentUserId: string | undefined;
  busy: boolean;
  /** Which of this row's actions is in flight, for its button's spinner. */
  pendingKind: DwrAction | null;
  /** A locked project: the row is a link and its facts, with no actions (036 Wave 3). */
  readOnly: boolean;
  onAct: (kind: DwrAction, reason?: string) => void;
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
    <tr className={clsx(TABLE.row, 'align-top')}>
      <td className={clsx(TABLE.td, 'align-top')}>
        <Link
          href={ROUTES.projectsDwrReport(projectId, report.id)}
          className="font-medium text-blue-700 hover:underline"
        >
          {report.dprNumber}
        </Link>
      </td>
      <td className={clsx(TABLE.td, 'align-top')}>
        {dateLabel(report.workDate)}
      </td>
      <td className={clsx(TABLE.td, 'align-top')}>
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
      <td className={clsx(TABLE.td, TABLE.numeric, 'align-top')}>
        {report.lineCount === 0 ? (
          <span className="text-gray-500">none</span>
        ) : (
          report.lineCount
        )}
      </td>
      <td
        className={clsx(TABLE.td, 'whitespace-nowrap align-top text-gray-600')}
      >
        {report.workerCount ?? 0} people · {report.machineryCount ?? 0} machines
      </td>
      {!readOnly && (
      <td className={clsx(TABLE.td, 'align-top')}>
        <div className="flex flex-wrap justify-end gap-2">
          {report.status === 'draft' || report.status === 'returned' ? (
            <>
              <Button
                disabled={busy}
                loading={pendingKind === 'submit'}
                onClick={() => onAct('submit')}
              >
                Submit
              </Button>
              {/* 025 FR-026. A draft entered against the wrong project or the wrong day had no way
                  out: the endpoint has existed since 022 and nothing called it. */}
              <Button
                disabled={busy}
                loading={pendingKind === 'delete'}
                intent="write"
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Delete this draft?',
                      message:
                        'Delete this draft? Nothing has moved yet, so nothing is taken back.',
                      confirmLabel: 'Delete',
                      tone: 'danger',
                    })
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
                loading={pendingKind === 'approve'}
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
                loading={pendingKind === 'return'}
                intent="write"
                onClick={async () => {
                  const reason = await promptDialog({
                    title: 'Return to the author?',
                    message: 'Why is this going back to the author?',
                    required: true,
                    multiline: true,
                    confirmLabel: 'Return',
                    tone: 'danger',
                  });
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
              loading={pendingKind === 'reverse'}
              onClick={async () => {
                const reason = await promptDialog({
                  title: 'Reverse this approval?',
                  message:
                    'Why is this approval being reversed? The quantity it added will be taken back.',
                  required: true,
                  multiline: true,
                  confirmLabel: 'Reverse',
                  tone: 'danger',
                });
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
      )}
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
