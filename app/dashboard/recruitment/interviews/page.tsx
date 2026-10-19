'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { listEmployees } from '@/app/lib/api/hr-payroll';
import {
  getCandidates,
  getInterviewsPage,
  interviewerName,
  rescheduleInterview,
  scheduleInterview,
  submitInterviewFeedback,
  type Interview,
} from '@/app/lib/api/recruitment';
import {
  INTERVIEW_MODES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_ROUND_TYPES,
  recruitmentLabel,
} from '@/app/lib/constants';
import {
  urlEnum,
  urlNumber,
  useDebounced,
  useUrlState,
} from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import { Button, IconButton } from '@/app/ui/button';
import QueryError from '@/app/ui/query-error';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';
import { ListSkeleton } from '@/app/ui/skeletons';
import { todayIso, businessDate, dateTimeLabel } from '@/app/lib/format';

/**
 * 036 H4: the screen read every interview the company had ever held in one request. Now one page
 * of one status at a time — open rounds, completed or cancelled — with the status and page in the
 * URL. The server sends the total in a header `authFetch` cannot read, so Next is offered while a
 * full page came back.
 */
const PAGE_SIZE = 50;
const STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
const STATUS_TABS: Record<(typeof STATUSES)[number], string> = {
  scheduled: 'Open',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Now as a `datetime-local` value, for its `min`. The field is read and written in the browser's
 * own zone (`new Date(value)` below parses it that way), so its bound is too — on an IST machine
 * that is IST.
 */
function nowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InterviewsPage() {
  return (
    <Suspense fallback={<ListSkeleton headers={['Interview']} cards />}>
      <InterviewsInner />
    </Suspense>
  );
}

function InterviewsInner() {
  const queryClient = useQueryClient();
  const [showSchedule, setShowSchedule] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Interview | null>(null);
  const [filters, setFilters, query] = useUrlState(
    { status: urlEnum(STATUSES, 'scheduled'), page: urlNumber(1) },
    { resetPage: 'page' },
  );

  const interviews = useQuery({
    queryKey: ['interviews', 'page', query.status, query.page],
    queryFn: () =>
      getInterviewsPage({
        status: query.status,
        page: query.page,
        pageSize: PAGE_SIZE,
        // Open rounds soonest first; finished ones most recent first.
        order: query.status === 'scheduled' ? 'asc' : 'desc',
      }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['interviews'] });

  const list = interviews.data?.items ?? [];
  const total = interviews.data?.total ?? null;
  const pageCount =
    total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Without the header's total, Next is offered while a full page came back.
  const hasNext =
    pageCount === null ? list.length === PAGE_SIZE : query.page < pageCount;
  // A page past the end (a stale link, or the last round on it just completed) goes back to the
  // last one that has rows rather than showing an empty page.
  const lastPage =
    !interviews.isPlaceholderData && pageCount !== null && query.page > pageCount
      ? pageCount
      : null;
  useEffect(() => {
    if (lastPage !== null) setFilters({ page: lastPage });
  }, [lastPage, setFilters]);
  const today = todayIso();
  // Grouped by what is left to do (2026-10-14); since 036 H4 the open rounds only, the completed
  // and cancelled ones each being a tab of their own.
  const groups: Record<string, Interview[]> =
    query.status === 'scheduled'
      ? {
          'Awaiting feedback': list.filter((i) => i.overdue),
          Today: list.filter(
            (i) => !i.overdue && businessDate(i.scheduledAt) === today,
          ),
          Upcoming: list.filter(
            (i) => !i.overdue && businessDate(i.scheduledAt) > today,
          ),
        }
      : { [STATUS_TABS[query.status]]: list };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Interviews"
          description="Rounds awaiting feedback, today's and upcoming, and completed rounds with their feedback."
        />
        <Button onClick={() => setShowSchedule(true)}>
          Schedule Interview
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Interview status"
        className="mb-4 inline-flex rounded-lg border border-gray-200 p-0.5"
      >
        {STATUSES.map((status) => (
          <button
            key={status}
            role="tab"
            aria-selected={filters.status === status}
            className={`rounded-md px-3 py-1 text-sm ${filters.status === status ? 'bg-gray-100 font-medium' : ''}`}
            onClick={() => setFilters({ status })}
          >
            {STATUS_TABS[status]}
          </button>
        ))}
      </div>

      {interviews.isPending ? (
        <ListSkeleton headers={['Interview']} rows={4} cards />
      ) : interviews.isError ? (
        <QueryError
          error={interviews.error}
          onRetry={interviews.refetch}
          fallback="Could not load interviews."
        />
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-500">
          {query.page > 1
            ? 'No more interviews.'
            : query.status === 'scheduled'
              ? 'No interviews scheduled.'
              : `No ${STATUS_TABS[query.status].toLowerCase()} interviews.`}
        </p>
      ) : null}

      {interviews.data && list.length > 0 && (
        <div
          className={interviews.isPlaceholderData ? 'opacity-60' : undefined}
        >
          {Object.keys(groups).map((label) => (
            <section key={label} className="mb-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                {label}
              </h2>
              {groups[label].length === 0 ? (
                <p className="text-sm text-gray-500">Nothing here.</p>
              ) : (
                <div className="space-y-2">
                  {groups[label].map((i) => (
                    <div
                      key={i.id}
                      className="rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {i.candidateName} — Round {i.roundNumber} (
                            {recruitmentLabel(i.roundType)})
                          </p>
                          <p className="text-xs text-gray-500">
                            {dateTimeLabel(i.scheduledAt)} ·{' '}
                            {recruitmentLabel(i.mode)}
                            {i.location ? ` · ${i.location}` : ''}
                          </p>
                          {i.interviewerEmployeeIds.length > 0 && (
                            <p className="text-xs text-gray-500">
                              Panel:{' '}
                              {i.interviewerEmployeeIds
                                .map((id) => interviewerName(i, id))
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={i.status} />
                          {i.overdue && (
                            <StatusBadge status="overdue" label="Overdue" />
                          )}
                          {i.status === 'scheduled' && (
                            <>
                              <RowAction onClick={() => setFeedbackFor(i)}>
                                {i.feedback.length > 0
                                  ? 'Add feedback'
                                  : 'Feedback'}
                              </RowAction>
                              {i.feedback.length === 0 && (
                                <RowAction onClick={() => setRescheduleFor(i)}>
                                  Reschedule
                                </RowAction>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                      <FeedbackList interview={i} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {(query.page > 1 || hasNext) && interviews.data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600" aria-live="polite">
            Page {query.page}
            {pageCount !== null && ` of ${pageCount}`}
            {total !== null && ` · ${total} ${total === 1 ? 'interview' : 'interviews'}`}
          </p>
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              disabled={query.page <= 1 || interviews.isFetching}
              onClick={() => setFilters({ page: query.page - 1 })}
            >
              Previous
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={!hasNext || interviews.isFetching}
              onClick={() => setFilters({ page: query.page + 1 })}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      )}

      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onSaved={() => {
            invalidate();
            setShowSchedule(false);
          }}
        />
      )}
      {feedbackFor && (
        <FeedbackModal
          interview={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onSaved={() => {
            invalidate();
            setFeedbackFor(null);
          }}
        />
      )}
      {rescheduleFor && (
        <RescheduleModal
          interview={rescheduleFor}
          onClose={() => setRescheduleFor(null)}
          onSaved={() => {
            invalidate();
            setRescheduleFor(null);
          }}
        />
      )}
    </div>
  );
}

function ScheduleModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    candidateId: '',
    roundNumber: '1',
    roundType: 'technical',
    scheduledAt: '',
    mode: 'video',
    location: '',
  });
  const [interviewers, setInterviewers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // 036 H4: Schedule had no lock, so a second tap while the first was out booked the round twice.
  const mutation = useMutation({
    mutationFn: () =>
      scheduleInterview(form.candidateId, {
        roundNumber: Number(form.roundNumber),
        roundType: form.roundType,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        mode: form.mode,
        interviewerEmployeeIds: interviewers,
        location: form.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Interview scheduled');
      onSaved();
    },
    onError: (e) => setError(errorMessage(e, 'Could not schedule.')),
  });

  const valid = form.candidateId && form.scheduledAt && interviewers.length > 0;
  const submit = () => {
    setError(null);
    // `min` stops the picker, not a typed value or a form left open past the hour.
    if (new Date(form.scheduledAt).getTime() <= Date.now()) {
      setError('Pick a time in the future.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      title="Schedule Interview"
      onClose={onClose}
      wide
      isDirty={Boolean(
        form.candidateId || form.scheduledAt || interviewers.length,
      )}
      pending={mutation.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={submit}
            disabled={!valid}
            loading={mutation.isPending}
          >
            Schedule
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <div>
          <label
            htmlFor="i-cand"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Candidate *
          </label>
          {/* Only somebody still in the running is interviewed: an applied candidate is shortlisted
              first, and a rejected or joined one has nothing left to be interviewed for. Searched
              on the server (036 H4) — the first 200 candidates, filtered here, hid everyone else. */}
          <AsyncSelect
            id="i-cand"
            value={form.candidateId}
            onChange={(id) => set('candidateId', id)}
            placeholder="Candidate name"
            cacheKey={['candidates', 'interviewable']}
            search={async (term, page) => {
              const [shortlisted, interviewing] = await Promise.all(
                (['shortlisted', 'interviewing'] as const).map((stage) =>
                  getCandidates({
                    stage,
                    search: term || undefined,
                    page,
                    pageSize: 25,
                  }),
                ),
              );
              return {
                total: shortlisted.total + interviewing.total,
                items: [...shortlisted.items, ...interviewing.items].map(
                  (c) => ({
                    id: c.id,
                    label: c.fullName,
                    note: recruitmentLabel(c.stage),
                  }),
                ),
              };
            }}
          />
        </div>
        <TextField
          id="i-round"
          label="Round number"
          type="number"
          min="1"
          value={form.roundNumber}
          onChange={(e) => set('roundNumber', e.target.value)}
        />
        <SelectField
          id="i-type"
          label="Round type"
          value={form.roundType}
          onChange={(e) => set('roundType', e.target.value)}
        >
          {INTERVIEW_ROUND_TYPES.map((t) => (
            <option key={t} value={t}>
              {recruitmentLabel(t)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="i-mode"
          label="Mode"
          value={form.mode}
          onChange={(e) => set('mode', e.target.value)}
        >
          {INTERVIEW_MODES.map((m) => (
            <option key={m} value={m}>
              {recruitmentLabel(m)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="i-when"
          label="Scheduled at *"
          type="datetime-local"
          min={nowForInput()}
          value={form.scheduledAt}
          onChange={(e) => set('scheduledAt', e.target.value)}
        />
        <TextField
          id="i-loc"
          label="Location (optional)"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
        />
        <div className="sm:col-span-2">
          <InterviewerPicker
            selected={interviewers}
            onChange={setInterviewers}
          />
        </div>
      </div>
    </Modal>
  );
}

function FeedbackModal({
  interview,
  onClose,
  onSaved,
}: {
  interview: Interview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const nameOf = (id: string) => interviewerName(interview, id);
  // Who has already given theirs: a panel member submits once, so they are not offered again.
  const given = new Set(interview.feedback.map((f) => f.interviewerEmployeeId));
  const pending = interview.interviewerEmployeeIds.filter(
    (id) => !given.has(id),
  );
  const [interviewerEmployeeId, setInterviewerEmployeeId] = useState(
    pending[0] ?? interview.interviewerEmployeeIds[0] ?? '',
  );
  const [outcome, setOutcome] = useState('recommend');
  const [score, setScore] = useState('7');
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      submitInterviewFeedback(interview.id, {
        interviewerEmployeeId,
        outcome,
        score: Number(score),
        comments,
      }),
    onSuccess: () => {
      toast.success('Feedback submitted');
      onSaved();
    },
    onError: (e) => setError(errorMessage(e, 'Could not submit feedback.')),
  });

  const valid = interviewerEmployeeId && outcome && score && comments.trim();

  return (
    <Modal
      title="Interview Feedback"
      onClose={onClose}
      isDirty={Boolean(comments)}
      pending={mutation.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
            loading={mutation.isPending}
          >
            Submit
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="f-iv"
          label="Interviewer"
          hint={
            given.size > 0
              ? `Already given by ${[...given].map(nameOf).join(', ')}.`
              : interview.interviewerEmployeeIds.length > 1
                ? 'Each member of the panel gives their own. The round completes once all have.'
                : undefined
          }
          value={interviewerEmployeeId}
          onChange={(e) => setInterviewerEmployeeId(e.target.value)}
        >
          {(pending.length > 0
            ? pending
            : interview.interviewerEmployeeIds
          ).map((id) => (
            <option key={id} value={id}>
              {nameOf(id)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="f-out"
          label="Outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          {INTERVIEW_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {recruitmentLabel(o)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="f-score"
          label="Score (1–10)"
          type="number"
          min="1"
          max="10"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
        <label htmlFor="f-com" className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Comments</span>
          <textarea
            id="f-com"
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </div>
    </Modal>
  );
}

function RescheduleModal({
  interview,
  onClose,
  onSaved,
}: {
  interview: Interview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      rescheduleInterview(interview.id, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        reason,
      }),
    onSuccess: () => {
      toast.success('Interview rescheduled');
      onSaved();
    },
    onError: (e) => setError(errorMessage(e, 'Could not reschedule.')),
  });
  return (
    <Modal
      title="Reschedule Interview"
      onClose={onClose}
      isDirty={Boolean(scheduledAt || reason)}
      pending={mutation.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              if (new Date(scheduledAt).getTime() <= Date.now()) {
                setError('Pick a time in the future.');
                return;
              }
              mutation.mutate();
            }}
            disabled={!scheduledAt || !reason.trim()}
            loading={mutation.isPending}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField
          id="rs-when"
          label="New time *"
          type="datetime-local"
          min={nowForInput()}
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <TextField
          id="rs-reason"
          label="Reason *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/**
 * The interview panel, picked by name (2026-10-14) — a searchable list of active employees with a
 * checkbox each, the chosen ones shown as removable chips above it.
 *
 * 036 H4: searched on the server. It loaded the first 100 active employees and filtered those, so
 * the 101st could not be put on a panel at all. The chips keep the names of whoever was ticked,
 * since a later search may no longer list them.
 */
function InterviewerPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [names, setNames] = useState<Record<string, string>>({});
  const matches = useQuery({
    queryKey: ['hr', 'employees', 'interviewers', term],
    queryFn: () =>
      listEmployees({
        search: term || undefined,
        isActive: true,
        pageSize: 25,
      }),
    placeholderData: keepPreviousData,
  });
  const people = (matches.data?.items ?? []).map((e) => ({
    id: e.id,
    name: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.employeeCode,
    code: e.employeeCode,
  }));
  const more = (matches.data?.total ?? 0) - people.length;
  const nameOf = (id: string) => names[id] ?? id;
  const toggle = (person: { id: string; name: string }) => {
    setNames((n) => ({ ...n, [person.id]: person.name }));
    onChange(
      selected.includes(person.id)
        ? selected.filter((x) => x !== person.id)
        : [...selected, person.id],
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">Interviewers *</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
            >
              {nameOf(id)}
              <IconButton
                size="xs"
                label={`Remove ${nameOf(id)}`}
                onClick={() => toggle({ id, name: nameOf(id) })}
              >
                ×
              </IconButton>
            </span>
          ))}
        </div>
      )}
      <input
        type="search"
        placeholder="Search by name or code"
        aria-label="Search interviewers"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
        {matches.isPending ? (
          <p className="p-3 text-sm text-gray-500">Loading employees…</p>
        ) : matches.isError ? (
          <QueryError
            compact
            error={matches.error}
            onRetry={matches.refetch}
            fallback="The employee list could not be read — it needs access to HR employees."
          />
        ) : people.length === 0 ? (
          <p className="p-3 text-sm text-gray-500">No employee matches.</p>
        ) : (
          <>
            {people.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p)}
                />
                <span className="text-gray-900">{p.name}</span>
                <span className="ml-auto text-xs text-gray-500">{p.code}</span>
              </label>
            ))}
            {more > 0 && (
              <p className="px-3 py-2 text-xs text-gray-500">
                {more} more — type a name or code to narrow the list.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A round's feedback, one entry per panel member, and who has yet to give theirs (2026-10-14).
 * Comments keep their line breaks — they are written as paragraphs and read as them.
 */
function FeedbackList({ interview }: { interview: Interview }) {
  const nameOf = (id: string) => interviewerName(interview, id);
  const given = new Set(interview.feedback.map((f) => f.interviewerEmployeeId));
  const awaiting = interview.interviewerEmployeeIds.filter(
    (id) => !given.has(id),
  );
  if (interview.feedback.length === 0) return null;

  const tone: Record<string, string> = {
    recommend: 'bg-green-50 text-green-800',
    hold: 'bg-amber-50 text-amber-900',
    reject: 'bg-red-50 text-red-800',
  };
  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      {interview.feedback.map((f) => (
        <div key={f.interviewerEmployeeId} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">
              {nameOf(f.interviewerEmployeeId)}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone[f.outcome] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {recruitmentLabel(f.outcome)}
            </span>
            <span className="text-xs text-gray-500">{f.score}/10</span>
          </div>
          <p className="mt-0.5 whitespace-pre-line text-gray-700">
            {f.comments}
          </p>
        </div>
      ))}
      {awaiting.length > 0 && (
        <p className="text-xs text-amber-800">
          Awaiting feedback from {awaiting.map(nameOf).join(', ')}.
        </p>
      )}
    </div>
  );
}
