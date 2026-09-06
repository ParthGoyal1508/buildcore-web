import type { Metadata } from 'next';
import RoleList from '@/app/ui/settings/role-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Roles' };

export default function RolesPage() {
  return (
    <main>
      <PageHeader title="Roles" className="mb-6" />
      <RoleList />
    </main>
  );
}
