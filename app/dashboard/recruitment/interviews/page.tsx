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

export default function InterviewsPage() {
  const queryClient = useQueryClient();
  const [showSchedule, setShowSchedule] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Interview | null>(null);

  const interviews = useQuery({ queryKey: ['interviews'], queryFn: () => getInterviews() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['interviews'] });

  const list = interviews.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const groups = {
    Overdue: list.filter((i) => i.overdue),
    Today: list.filter((i) => !i.overdue && i.scheduledAt.slice(0, 10) === today),
    Upcoming: list.filter((i) => !i.overdue && i.scheduledAt.slice(0, 10) > today),
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Interviews</h1>
          <p className="text-sm text-gray-500">Today&apos;s, upcoming and overdue rounds.</p>
        </div>
        <Button onClick={() => setShowSchedule(true)}>Schedule Interview</Button>
      </div>

      {interviews.isPending && <p className="text-sm text-gray-500">Loading…</p>}

      {(['Overdue', 'Today', 'Upcoming'] as const).map((label) => (
        <section key={label} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{label}</h2>
          {groups[label].length === 0 ? (
            <p className="text-sm text-gray-400">Nothing here.</p>
          ) : (
            <div className="space-y-2">
              {groups[label].map((i) => (
                <div key={i.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {i.candidateName} — Round {i.roundNumber} ({recruitmentLabel(i.roundType)})
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(i.scheduledAt).toLocaleString()} · {recruitmentLabel(i.mode)}
                        {i.location ? ` · ${i.location}` : ''}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={i.status} />
                      {i.overdue && <StatusBadge status="overdue" label="Overdue" />}
                      {i.status === 'scheduled' && (
                        <>
                          <RowAction onClick={() => setFeedbackFor(i)}>Feedback</RowAction>
                          <RowAction onClick={() => setRescheduleFor(i)}>Reschedule</RowAction>
                        </>
                      )}
                    </span>
                  </div>
                  {i.feedback.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {i.feedback.map((f, idx) => (
                        <li key={idx}>
                          {f.interviewerEmployeeId}: {recruitmentLabel(f.outcome)} ({f.score}/10) — {f.comments}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {showSchedule && (
        <ScheduleModal onClose={() => setShowSchedule(false)} onSaved={() => { invalidate(); setShowSchedule(false); }} />
      )}
      {feedbackFor && (
        <FeedbackModal interview={feedbackFor} onClose={() => setFeedbackFor(null)} onSaved={() => { invalidate(); setFeedbackFor(null); }} />
      )}
      {rescheduleFor && (
        <RescheduleModal interview={rescheduleFor} onClose={() => setRescheduleFor(null)} onSaved={() => { invalidate(); setRescheduleFor(null); }} />
      )}
    </div>
  );
}

function ScheduleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
    interviewerEmployeeIds: '',
    location: '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      scheduleInterview(form.candidateId, {
        roundNumber: Number(form.roundNumber),
        roundType: form.roundType,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        mode: form.mode,
        interviewerEmployeeIds: form.interviewerEmployeeIds.split(',').map((s) => s.trim()).filter(Boolean),
        location: form.location || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not schedule.'),
  });

  const valid = form.candidateId && form.scheduledAt && form.interviewerEmployeeIds.trim();

  return (
    <Modal
      title="Schedule Interview"
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!valid}>Schedule</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <SelectField id="i-cand" label="Candidate" value={form.candidateId} onChange={(e) => set('candidateId', e.target.value)}>
          <option value="">Select…</option>
          {candidates.data?.items.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </SelectField>
        <TextField id="i-round" label="Round number" type="number" min="1" value={form.roundNumber} onChange={(e) => set('roundNumber', e.target.value)} />
        <SelectField id="i-type" label="Round type" value={form.roundType} onChange={(e) => set('roundType', e.target.value)}>
          {INTERVIEW_ROUND_TYPES.map((t) => <option key={t} value={t}>{recruitmentLabel(t)}</option>)}
        </SelectField>
        <SelectField id="i-mode" label="Mode" value={form.mode} onChange={(e) => set('mode', e.target.value)}>
          {INTERVIEW_MODES.map((m) => <option key={m} value={m}>{recruitmentLabel(m)}</option>)}
        </SelectField>
        <TextField id="i-when" label="Scheduled at" type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} />
        <TextField id="i-loc" label="Location (optional)" value={form.location} onChange={(e) => set('location', e.target.value)} />
        <div className="sm:col-span-2">
          <TextField id="i-ivs" label="Interviewer employee ids (comma-separated)" value={form.interviewerEmployeeIds} onChange={(e) => set('interviewerEmployeeIds', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function FeedbackModal({ interview, onClose, onSaved }: { interview: Interview; onClose: () => void; onSaved: () => void }) {
  const [interviewerEmployeeId, setInterviewerEmployeeId] = useState(interview.interviewerEmployeeIds[0] ?? '');
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
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not submit feedback.'),
  });

  const valid = interviewerEmployeeId && outcome && score && comments;

  return (
    <Modal
      title="Interview Feedback"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!valid}>Submit</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField id="f-iv" label="Interviewer" value={interviewerEmployeeId} onChange={(e) => setInterviewerEmployeeId(e.target.value)}>
          {interview.interviewerEmployeeIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </SelectField>
        <SelectField id="f-out" label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {INTERVIEW_OUTCOMES.map((o) => <option key={o} value={o}>{recruitmentLabel(o)}</option>)}
        </SelectField>
        <TextField id="f-score" label="Score (1–10)" type="number" min="1" max="10" value={score} onChange={(e) => setScore(e.target.value)} />
        <TextField id="f-com" label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>
    </Modal>
  );
}

function RescheduleModal({ interview, onClose, onSaved }: { interview: Interview; onClose: () => void; onSaved: () => void }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => rescheduleInterview(interview.id, { scheduledAt: new Date(scheduledAt).toISOString(), reason }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not reschedule.'),
  });
  return (
    <Modal
      title="Reschedule Interview"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!scheduledAt || !reason}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField id="rs-when" label="New time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <TextField id="rs-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
