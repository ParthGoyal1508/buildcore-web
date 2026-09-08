import type { Metadata } from 'next';
import ReimbursementClaims from '@/app/ui/my/reimbursement-claims';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Reimbursements' };

export default function MyReimbursementsPage() {
  return (
    <main>
      <PageHeader title="Reimbursements" className="mb-4" />
      <ReimbursementClaims />
    </main>
  );
}
