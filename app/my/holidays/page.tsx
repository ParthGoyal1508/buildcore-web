import type { Metadata } from 'next';

import HolidayList from '@/app/ui/my/holiday-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Holidays' };

export default function MyHolidaysPage() {
  return (
    <main>
      <PageHeader title="Holidays" className="mb-4" />
      <HolidayList />
    </main>
  );
}
