import type { Metadata } from 'next';
import CompanyList from '@/app/ui/settings/company-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Companies' };

export default function CompaniesPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Companies" />
      <CompanyList />
      {/* The cash visibility toggle lived here until 2026-10-14, when it moved to a Settings
          section of its own — Super Admin only, behind their password. See
          `app/dashboard/settings/personal-settings/page.tsx`. */}
    </main>
  );
}
