import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import TdsWorkspace from '@/app/ui/hr/tds-workspace';

export const metadata: Metadata = { title: 'TDS' };

export default function TdsPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>TDS</h1>
      <p className="mb-6 text-sm text-gray-600">
        Slab configuration, employee declarations and the quarterly return. TDS is
        projected across the remaining months of the year, so a mid-year change
        spreads rather than landing in one payslip.
      </p>
      <TdsWorkspace />
    </main>
  );
}
