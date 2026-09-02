import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import LeaveWorkspace from '@/app/ui/hr/leave-workspace';

export const metadata: Metadata = { title: 'Leave' };

export default function LeavePage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Leave</h1>
      <LeaveWorkspace />
    </main>
  );
}
