import type { Metadata } from 'next';

import MyResignation from '@/app/ui/my/my-resignation';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Resignation' };

export default function Page() {
  return (
    <main>
      <PageHeader title="Resignation" className="mb-4" />
      <MyResignation />
    </main>
  );
}
