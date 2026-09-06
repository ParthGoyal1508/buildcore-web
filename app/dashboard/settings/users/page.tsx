import type { Metadata } from 'next';
import UserList from '@/app/ui/settings/user-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <main>
      <PageHeader title="Users" className="mb-6" />
      <UserList />
    </main>
  );
}
