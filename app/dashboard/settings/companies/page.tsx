import type { Metadata } from 'next';
import CompanyList from '@/app/ui/settings/company-list';
import CashVisibility from '@/app/ui/settings/cash-visibility';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Companies' };

export default function CompaniesPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Companies" />
      <CompanyList />
      {/*
        The cash visibility toggle's canonical home (019 FR-012, `bugs.md` item 16). It is also in
        the shell header, where the client asked for it, because the situation it exists for is
        situational. This is where somebody goes *looking* for it, and where there is room to say
        what it does and does not do — it renders nothing for anyone who cannot change it.
      */}
      <CashVisibility />
    </main>
  );
}
