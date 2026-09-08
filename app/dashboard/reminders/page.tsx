import RemindersList from '@/app/ui/dashboard/reminders-list';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Reminders' };

/**
 * The Reminders centre (spec US9).
 *
 * A Server Component wrapper around a client list, matching every other screen in the
 * shell: the page owns the heading and the client component owns the data, so the
 * `'use client'` boundary sits as low as it can.
 */
export default function RemindersPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Reminders"
        description="Everything falling due across every module, overdue first."
      />
      <RemindersList />
    </main>
  );
}
