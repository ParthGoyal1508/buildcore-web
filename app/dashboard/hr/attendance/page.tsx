import type { Metadata } from 'next';

import AttendanceWorkspace from '@/app/ui/hr/attendance-workspace';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Attendance' };

export default function AttendancePage() {
  return (
    <main>
      <PageHeader title="Attendance" className="mb-6" />
      <AttendanceWorkspace />
    </main>
  );
}
