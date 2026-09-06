import type { Metadata } from 'next';
import PunchClock from '@/app/ui/my/punch-clock';
import AttendanceHistory from '@/app/ui/my/attendance-history';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Punch' };

export default function MyPunchPage() {
  return (
    <main>
      <PageHeader title="My Punch" className="mb-4" />
      <PunchClock />
      <AttendanceHistory />
    </main>
  );
}
