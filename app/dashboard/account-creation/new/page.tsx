import type { Metadata } from 'next';
import CreateUserForm from '@/app/ui/account-creation/create-user-form';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Invite a user' };

export default function NewUserPage() {
  return (
    <main>
      <PageHeader
        title="Invite a user"
        description="The account is created without a password. We email a single-use link that lets the person set their own, and it expires after 48 hours."
        className="mb-6"
      />
      <CreateUserForm />
    </main>
  );
}
