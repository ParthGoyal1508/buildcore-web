import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import RoleList from '@/app/ui/settings/role-list';

export const metadata: Metadata = { title: 'Roles' };

export default function RolesPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Roles</h1>
      <RoleList />
    </main>
  );
}
