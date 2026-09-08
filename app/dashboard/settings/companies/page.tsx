import type { Metadata } from 'next';
import CompanyList from '@/app/ui/settings/company-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Companies' };

export default function CompaniesPage() {
  return (
    <main>
      <PageHeader title="Companies" className="mb-6" />
      <CompanyList />
    </main>
  );
}
