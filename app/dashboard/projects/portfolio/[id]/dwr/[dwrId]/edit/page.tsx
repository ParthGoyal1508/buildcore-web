'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { getDwr } from '@/app/lib/api/dwr';
import DwrForm from '@/app/ui/projects/dwr-form';
import DwrReturnedNotice from '@/app/ui/projects/dwr-returned-notice';
import SectionGuard from '@/app/ui/projects/section-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Correcting a draft (022 FR-018, 025 FR-026).
 *
 * `updateDwr` has existed in the api module since 025 and **nothing ever called it**, so a draft
 * was a dead end: it could be recorded and submitted, and a mistyped depth could only be fixed by
 * deleting the day and typing it again.
 *
 * The same form the report was recorded in, pre-filled — not a second one. A separate edit form
 * would be a second place for the factor mapping to drift, and that mapping has been wrong once
 * already.
 *
 * **A draft or a report returned for correction, and the refusal is here as well as on the
 * server.** The server refuses a submitted or approved report by status; this says so before the
 * person has filled anything in, and names the route back — return it to its author, or reverse
 * the approval.
 *
 * `returned` is accepted because a returned report is a draft carrying a complaint (028), and this
 * is the screen the reviewer's complaint sends the author to. Testing for `draft` alone made the
 * review loop a dead end the moment `returned` became a status of its own: the report page said
 * "edit it as you would a draft" and this page answered that it could not be edited.
 */
export default function EditDwrPage() {
  const { project } = useProjectShell();
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

  if (report.status !== 'draft' && report.status !== 'returned') {
    return (
      <SectionGuard permission="DWR">
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <strong>{report.dprNumber}</strong> is {report.status}, so it cannot be
          edited.{' '}
          {report.status === 'submitted'
            ? 'Return it to its author first — a report under review is a claim somebody is reading.'
            : 'Reverse the approval first — approving it moved executed quantities a bill may already have been built from.'}
        </p>
      </SectionGuard>
    );
  }

  return (
    <SectionGuard permission="DWR">
      <div className="flex flex-col gap-4">
        {/* The complaint stays on screen while it is being answered. An author who has to
            navigate back to read what was wrong is an author correcting from memory. */}
        <DwrReturnedNotice report={report} />
        <DwrForm projectId={project.id} report={report} />
      </div>
    </SectionGuard>
  );
}
