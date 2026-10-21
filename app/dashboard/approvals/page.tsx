import ApprovalHistory from '@/app/ui/approvals/approval-history';
import ApprovalQueue from '@/app/ui/approvals/queue-table';
import ApprovalUpcoming from '@/app/ui/approvals/upcoming-table';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Approvals' };

/**
 * Everything awaiting this user's decision, across every module (spec US3) — and, since
 * 2026-10-15, every approval they may read underneath it.
 *
 * Two sections rather than one list with a filter. "Waiting on you" is the queue, with
 * the decision controls on each row; the history below is read-only and shows each
 * item's whole chain. Kept apart because they answer different questions — "what do I
 * have to do" and "what happened" — and because the client asked for the second to be
 * there even when the first is empty: before this, a person with nothing pending opened
 * Approvals onto a blank page.
 *
 * A Server Component wrapper around client lists, matching every other screen in the
 * shell: the page owns the headings and the client components own the data, so the
 * `'use client'` boundary sits as low as it can.
 */
export default function ApprovalsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description="What is waiting on you — leave, claims, loans and advances included — what is on its way to you, and every approval you can see."
      />
      <section aria-labelledby="approvals-waiting" className="space-y-3">
        <h2
          id="approvals-waiting"
          className="text-base font-semibold text-gray-900"
        >
          Waiting on you
        </h2>
        <ApprovalQueue />
      </section>
      {/* Leave, claims, loans and advances are chains like everything else since 2026-10-20, so
          they are in the queue above. Items still on their way to this user follow. */}
      <ApprovalUpcoming />
      <section aria-labelledby="approvals-history" className="space-y-3">
        <h2
          id="approvals-history"
          className="text-base font-semibold text-gray-900"
        >
          Approval history
        </h2>
        <ApprovalHistory />
      </section>
    </main>
  );
}
