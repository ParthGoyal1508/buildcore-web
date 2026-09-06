import type { Metadata } from 'next';

import ChallansPanel from '@/app/ui/hr/challans-panel';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Challans' };

export default function ChallansPage() {
  return (
    <main>
      <PageHeader
        title="Statutory challans"
        description="Derived from processed payroll runs — the same line items the deduction report reconciles against."
        className="mb-6"
      />
      <ChallansPanel />
    </main>
  );
}
