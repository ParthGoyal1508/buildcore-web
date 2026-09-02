import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import AttendanceWorkspace from '@/app/ui/hr/attendance-workspace';

export const metadata: Metadata = { title: 'Attendance' };

export default function AttendancePage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Attendance</h1>
      <AttendanceWorkspace />
    </main>
  );
}
