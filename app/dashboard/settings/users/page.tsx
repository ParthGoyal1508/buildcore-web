import type { Metadata } from 'next';
import { Suspense } from 'react';
import UserList from '@/app/ui/settings/user-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <main>
      <PageHeader title="Users" className="mb-6" />
      {/* The list keeps its filters in the URL (036 C5), which reads `useSearchParams`. */}
      <Suspense>
        <UserList />
      </Suspense>
    </main>
  );
}
