import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import CreateUserForm from '@/app/ui/account-creation/create-user-form';

export const metadata: Metadata = { title: 'Invite a user' };

export default function NewUserPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>Invite a user</h1>
      <p className="mb-6 max-w-xl text-sm text-gray-600">
        The account is created without a password. We email a single-use link that
        lets the person set their own, and it expires after 48 hours.
      </p>
      <CreateUserForm />
    </main>
  );
}
