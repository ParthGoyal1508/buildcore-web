import type { Metadata } from 'next';

import TdsWorkspace from '@/app/ui/hr/tds-workspace';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'TDS' };

export default function TdsPage() {
  return (
    <main>
      <PageHeader
        title="TDS"
        description="Slab configuration, employee declarations and the quarterly return. TDS is projected across the remaining months of the year, so a mid-year change spreads rather than landing in one payslip."
        className="mb-6"
      />
      <TdsWorkspace />
    </main>
  );
}
