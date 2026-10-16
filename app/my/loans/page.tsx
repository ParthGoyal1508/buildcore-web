import type { Metadata } from 'next';

import MyLoans from '@/app/ui/my/my-loans';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Loans and advances' };

export default function Page() {
  return (
    <main>
      <PageHeader title="Loans and advances" className="mb-4" />
      <MyLoans />
    </main>
  );
}
