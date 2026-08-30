import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import CompanyList from '@/app/ui/settings/company-list';

export const metadata: Metadata = { title: 'Companies' };

export default function CompaniesPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Companies</h1>
      <CompanyList />
    </main>
  );
}
