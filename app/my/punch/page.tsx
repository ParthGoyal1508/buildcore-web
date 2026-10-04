import type { Metadata } from 'next';
import PunchClock from '@/app/ui/my/punch-clock';
import AttendanceHistory from '@/app/ui/my/attendance-history';
import PunchExceptions from '@/app/ui/my/punch-exceptions';
import RefusedAttempts from '@/app/ui/my/refused-attempts';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Punch' };

export default function MyPunchPage() {
  return (
    <main>
      <PageHeader title="My Punch" className="mb-4" />
      <PunchClock />
      {/*
        Above the month's history deliberately: a flagged punch may be waiting on this
        worker to resubmit it, and a section they have to scroll past the calendar to
        find is one they will not find. It renders as an empty note on the ordinary day
        when nothing is flagged.
      */}
      <PunchExceptions />
      {/*
        020 FR-012, T027. Between the exceptions and the calendar, and emphatically **not** inside
        the calendar: a refused punch wrote nothing to attendance, and putting it on a day would
        recreate the refused day the backend refuses to keep. Here, a worker refused at 8am and
        wondering at 5pm finds it on the screen they punched from, which is the one they will open.
      */}
      <RefusedAttempts />
      <AttendanceHistory />
    </main>
  );
}
