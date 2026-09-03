import { lusitana } from '@/app/ui/fonts';
import RemindersList from '@/app/ui/dashboard/reminders-list';

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
      <div>
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>
          Reminders
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Everything falling due across every module, overdue first.
        </p>
      </div>
      <RemindersList />
    </main>
  );
}
