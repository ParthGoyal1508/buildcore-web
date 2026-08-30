import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import UserList from '@/app/ui/settings/user-list';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Users</h1>
      <UserList />
    </main>
  );
}
