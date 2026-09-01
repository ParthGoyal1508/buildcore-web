import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import ReimbursementClaims from '@/app/ui/my/reimbursement-claims';

export const metadata: Metadata = { title: 'Reimbursements' };

export default function MyReimbursementsPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-2xl`}>Reimbursements</h1>
      <ReimbursementClaims />
    </main>
  );
}
