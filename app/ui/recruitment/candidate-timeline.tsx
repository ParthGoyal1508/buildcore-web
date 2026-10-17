'use client';

import { useQuery } from '@tanstack/react-query';

import {
  type Interview,
  getCandidateTimeline,
  getInterviews,
  interviewerName,
} from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';

/**
 * How a candidate got where they are (2026-10-14) — every stage change and every interview round,
 * in order, with who moved them and what each interviewer said.
 *
 * Stage changes come from the candidate's timeline (no contact details, so opening the panel is
 * not an audited reveal); rounds and their feedback from the interviews. An offer is not a separate
 * event: issuing and accepting one each move the stage, so they appear as those moves.
 */
export default function CandidateTimeline({ candidateId }: { candidateId: string }) {
  const timeline = useQuery({
    queryKey: ['candidate-timeline', candidateId],
    queryFn: () => getCandidateTimeline(candidateId),
  });
  const interviews = useQuery({
    queryKey: ['interviews', 'candidate', candidateId],
    queryFn: () => getInterviews({ candidateId }),
  });

  if (timeline.isPending || interviews.isPending) {
    return <p className="text-sm text-gray-500">Loading the timeline…</p>;
  }
  if (timeline.isError) {
    return <p className="text-sm text-red-700">The timeline could not be read.</p>;
  }

  type Event =
    | { at: string; kind: 'added' }
    | {
        at: string;
        kind: 'stage';
        from: string | null;
        to: string;
        by: string | null;
        remarks: string | null;
      }
    | { at: string; kind: 'interview'; interview: Interview };

  const events: Event[] = [
    {
      // The candidate's first stage row is when they entered the pipeline; the record's own
      // creation time can be later (an import, a backfill) and would sort "added" last.
      at:
        timeline.data.stages.find((s) => s.fromStage === null)?.occurredAt ??
        timeline.data.addedAt,
      kind: 'added' as const,
    },
    ...timeline.data.stages
      // The first row is the candidate being created at `applied` — the "added" event says it.
      .filter((s) => s.fromStage !== null)
      .map(
        (s): Event => ({
          at: s.occurredAt,
          kind: 'stage',
          from: s.fromStage,
          to: s.toStage,
          by: s.actorName,
          remarks:
            s.remarks ??
            (s.toStage === 'rejected' ? timeline.data.rejectionReason : null),
        }),
      ),
    ...(interviews.data ?? []).map(
      (i): Event => ({ at: i.scheduledAt, kind: 'interview', interview: i }),
    ),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <ol className="relative ml-2 border-l border-gray-200">
      {events.map((event, index) => (
        <li key={index} className="mb-4 ml-5 last:mb-0">
          <span
            className={`absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-white ${dotColour(event)}`}
            aria-hidden
          />
          <p className="text-xs text-gray-500">{when(event.at)}</p>
          {event.kind === 'added' && (
            <p className="text-sm font-medium text-gray-900">Added to the pipeline</p>
          )}
          {event.kind === 'stage' && (
            <>
              <p className="text-sm font-medium text-gray-900">
                {recruitmentLabel(event.to)}
                {event.from && (
                  <span className="font-normal text-gray-500">
                    {' '}
                    — from {recruitmentLabel(event.from)}
                  </span>
                )}
              </p>
              {event.by && <p className="text-xs text-gray-500">by {event.by}</p>}
              {event.remarks && (
                <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">
                  {event.remarks}
                </p>
              )}
            </>
          )}
          {event.kind === 'interview' && (
            <InterviewEvent interview={event.interview} />
          )}
        </li>
      ))}
    </ol>
  );
}

function InterviewEvent({ interview }: { interview: Interview }) {
  // Names from the interview itself (036 H4): the active-employee lookup this used printed a raw id
  // for anyone past its first page and for everyone who had since left.
  const nameOf = (id: string) => interviewerName(interview, id);
  const given = new Set(interview.feedback.map((f) => f.interviewerEmployeeId));
  const awaiting = interview.interviewerEmployeeIds.filter((id) => !given.has(id));
  const state =
    interview.status === 'completed'
      ? 'Completed'
      : interview.status === 'cancelled'
        ? 'Cancelled'
        : interview.overdue
          ? 'Awaiting feedback'
          : 'Scheduled';
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">
        Round {interview.roundNumber} · {recruitmentLabel(interview.roundType)} interview
        <span className="font-normal text-gray-500">
          {' '}
          — {state}
          {interview.rescheduleCount > 0
            ? `, rescheduled ${interview.rescheduleCount}×`
            : ''}
        </span>
      </p>
      <p className="text-xs text-gray-500">
        {recruitmentLabel(interview.mode)}
        {interview.location ? ` · ${interview.location}` : ''}
        {interview.interviewerEmployeeIds.length > 0 &&
          ` · Panel: ${interview.interviewerEmployeeIds.map(nameOf).join(', ')}`}
      </p>
      {interview.feedback.length > 0 && (
        <div className="mt-2 space-y-2 rounded-md bg-gray-50 p-2.5">
          {interview.feedback.map((f) => (
            <div key={f.interviewerEmployeeId}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-gray-900">
                  {nameOf(f.interviewerEmployeeId)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${OUTCOME_TONE[f.outcome] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {recruitmentLabel(f.outcome)}
                </span>
                <span className="text-xs text-gray-500">{f.score}/10</span>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-700">{f.comments}</p>
            </div>
          ))}
        </div>
      )}
      {interview.status === 'scheduled' && awaiting.length > 0 && interview.feedback.length > 0 && (
        <p className="mt-1 text-xs text-amber-800">
          Awaiting feedback from {awaiting.map(nameOf).join(', ')}.
        </p>
      )}
    </div>
  );
}

const OUTCOME_TONE: Record<string, string> = {
  recommend: 'bg-green-50 text-green-800',
  hold: 'bg-amber-50 text-amber-900',
  reject: 'bg-red-50 text-red-800',
};

function dotColour(event: {
  kind: string;
  to?: string;
  interview?: Interview;
}): string {
  if (event.kind === 'interview') {
    const i = event.interview as Interview;
    if (i.status === 'completed') return 'bg-brand-600';
    return i.overdue ? 'bg-amber-500' : 'bg-gray-300';
  }
  if (event.kind === 'stage') {
    if (event.to === 'rejected' || event.to === 'no_show') return 'bg-red-500';
    if (event.to === 'joined') return 'bg-green-600';
  }
  return 'bg-gray-500';
}

function when(iso: string): string {
  return dateTimeLabel(iso);
}
