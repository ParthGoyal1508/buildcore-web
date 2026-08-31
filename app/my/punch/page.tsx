import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import PunchClock from '@/app/ui/my/punch-clock';
import AttendanceHistory from '@/app/ui/my/attendance-history';

export const metadata: Metadata = { title: 'Punch' };

export default function MyPunchPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-2xl`}>My Punch</h1>
      <PunchClock />
      <AttendanceHistory />
    </main>
  );
}
