import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import LeaveBalancePanel from '@/app/ui/my/leave-balance';
import ApplyLeaveForm from '@/app/ui/my/apply-leave-form';
import LeaveApplications from '@/app/ui/my/leave-applications';

export const metadata: Metadata = { title: 'Leave' };

export default function MyLeavePage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-2xl`}>My Leave</h1>
      <LeaveBalancePanel />
      <ApplyLeaveForm />
      <LeaveApplications />
    </main>
  );
}
