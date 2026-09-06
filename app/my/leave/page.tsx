import type { Metadata } from 'next';
import LeaveBalancePanel from '@/app/ui/my/leave-balance';
import ApplyLeaveForm from '@/app/ui/my/apply-leave-form';
import LeaveApplications from '@/app/ui/my/leave-applications';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Leave' };

export default function MyLeavePage() {
  return (
    <main>
      <PageHeader title="My Leave" className="mb-4" />
      <LeaveBalancePanel />
      <ApplyLeaveForm />
      <LeaveApplications />
    </main>
  );
}
