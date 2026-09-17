import ApprovalQueue from '@/app/ui/approvals/queue-table';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Approvals' };

/**
 * Everything awaiting this user's decision, across every module (spec US3).
 *
 * A Server Component wrapper around a client list, matching every other screen in the
 * shell: the page owns the heading and the client component owns the data, so the
 * `'use client'` boundary sits as low as it can.
 */
export default function ApprovalsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description="Everything waiting on you, from every module, oldest first."
      />
      <ApprovalQueue />
    </main>
  );
}
