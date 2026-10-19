import type { Metadata } from 'next';

import BulkShiftChange from '@/app/ui/hr/bulk-shift-change';
import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Change Shifts' };

export default function BulkShiftPage() {
  return (
    <main>
      <PageHeader
        title="Change Shifts"
        description="Move many employees onto one shift at once — for the weekly or ten-day Day/Night rotation."
        breadcrumbs={[{ label: 'Employees', href: ROUTES.hrEmployees }]}
        className="mb-6"
      />
      <BulkShiftChange />
    </main>
  );
}
