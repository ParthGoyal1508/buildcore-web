import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import ChallansPanel from '@/app/ui/hr/challans-panel';

export const metadata: Metadata = { title: 'Challans' };

export default function ChallansPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>Statutory challans</h1>
      <p className="mb-6 text-sm text-gray-600">
        Derived from processed payroll runs — the same line items the deduction
        report reconciles against.
      </p>
      <ChallansPanel />
    </main>
  );
}
