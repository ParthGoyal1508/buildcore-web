'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getCandidates,
  getInterviews,
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
import { Button } from '@/app/ui/button';
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
import { useEmployees } from '@/app/ui/recruitment/use-employees';
import { LoadingText } from '@/app/ui/spinner';

export default function InterviewsPage() {
  const queryClient = useQueryClient();
  const employees = useEmployees();
  const [showSchedule, setShowSchedule] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Interview | null>(null);

  const interviews = useQuery({
    queryKey: ['interviews'],
    queryFn: () => getInterviews(),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['interviews'] });

  const list = interviews.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const open = list.filter((i) => i.status === 'scheduled');
  // Grouped by what is left to do (2026-10-14). The three date groups held only rounds still to
  // happen, so a completed one from an earlier day fell into none of them — and its feedback, the
  // reason anybody opens this page, was shown nowhere.
  const groups = {
    'Awaiting feedback': open.filter((i) => i.overdue),
    Today: open.filter(
      (i) => !i.overdue && i.scheduledAt.slice(0, 10) === today,
    ),
    Upcoming: open.filter(
      (i) => !i.overdue && i.scheduledAt.slice(0, 10) > today,
    ),
    Completed: list
      .filter((i) => i.status !== 'scheduled')
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <PageHeader
          title="Interviews"
          description="Rounds awaiting feedback, today's and upcoming, and completed rounds with their feedback."
        />
        <Button onClick={() => setShowSchedule(true)}>
          Schedule Interview
        </Button>
      </div>

      {interviews.isPending && (
        <p className="text-sm text-gray-500">
          <LoadingText />
        </p>
      )}

      {(['Awaiting feedback', 'Today', 'Upcoming', 'Completed'] as const).map(
        (label) => (
          <section key={label} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">
              {label}
            </h2>
            {groups[label].length === 0 ? (
              <p className="text-sm text-gray-400">Nothing here.</p>
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
                          {new Date(i.scheduledAt).toLocaleString()} ·{' '}
                          {recruitmentLabel(i.mode)}
                          {i.location ? ` · ${i.location}` : ''}
                        </p>
                        {i.interviewerEmployeeIds.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Panel:{' '}
                            {i.interviewerEmployeeIds
                              .map(employees.nameOf)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <span className="flex items-center gap-2">
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
                    <FeedbackList interview={i} nameOf={employees.nameOf} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ),
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
  const candidates = useQuery({
    queryKey: ['candidates', 'shortlisted-scope'],
    queryFn: () => getCandidates({ pageSize: 200 }),
  });
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
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not schedule.'),
  });

  const valid = form.candidateId && form.scheduledAt && interviewers.length > 0;
  // Only somebody still in the running is interviewed: an applied candidate is shortlisted first,
  // and a rejected or joined one has nothing left to be interviewed for.
  const interviewable = (candidates.data?.items ?? []).filter(
    (c) => c.stage === 'shortlisted' || c.stage === 'interviewing',
  );

  return (
    <Modal
      title="Schedule Interview"
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
          >
            Schedule
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <SelectField
          id="i-cand"
          label="Candidate"
          value={form.candidateId}
          onChange={(e) => set('candidateId', e.target.value)}
        >
          <option value="">Select…</option>
          {interviewable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </SelectField>
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
          label="Scheduled at"
          type="datetime-local"
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
  const employees = useEmployees();
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
    onSuccess: onSaved,
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : 'Could not submit feedback.',
      ),
  });

  const valid = interviewerEmployeeId && outcome && score && comments;

  return (
    <Modal
      title="Interview Feedback"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
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
              ? `Already given by ${[...given].map(employees.nameOf).join(', ')}.`
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
              {employees.nameOf(id)}
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
  const mutation = useMutation({
    mutationFn: () =>
      rescheduleInterview(interview.id, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        reason,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not reschedule.'),
  });
  return (
    <Modal
      title="Reschedule Interview"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!scheduledAt || !reason}
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
          label="New time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <TextField
          id="rs-reason"
          label="Reason"
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
 */
function InterviewerPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { people, nameOf, isError, isLoading } = useEmployees();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = term
    ? people.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term),
      )
    : people;
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">Interviewers</span>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
            >
              {nameOf(id)}
              <button
                type="button"
                aria-label={`Remove ${nameOf(id)}`}
                onClick={() => toggle(id)}
                className="text-blue-700 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="search"
        placeholder="Search by name or code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
        {isLoading ? (
          <p className="p-3 text-sm text-gray-500">Loading employees…</p>
        ) : isError ? (
          <p className="p-3 text-sm text-red-700">
            The employee list could not be read — it needs access to HR
            employees.
          </p>
        ) : shown.length === 0 ? (
          <p className="p-3 text-sm text-gray-500">No employee matches.</p>
        ) : (
          shown.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="text-gray-900">{p.name}</span>
              <span className="ml-auto text-xs text-gray-500">{p.code}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * A round's feedback, one entry per panel member, and who has yet to give theirs (2026-10-14).
 * Comments keep their line breaks — they are written as paragraphs and read as them.
 */
function FeedbackList({
  interview,
  nameOf,
}: {
  interview: Interview;
  nameOf: (id: string) => string;
}) {
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
