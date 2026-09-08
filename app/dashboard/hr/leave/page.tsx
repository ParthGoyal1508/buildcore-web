import type { Metadata } from 'next';

import LeaveWorkspace from '@/app/ui/hr/leave-workspace';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Leave' };

export default function LeavePage() {
  return (
    <main>
      <PageHeader title="Leave" className="mb-6" />
      <LeaveWorkspace />
    </main>
  );
}
