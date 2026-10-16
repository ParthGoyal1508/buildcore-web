import type { Metadata } from 'next';

import MyRequests from '@/app/ui/my/my-requests';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Requests' };

export default function Page() {
  return (
    <main>
      <PageHeader title="Requests" className="mb-4" />
      <MyRequests />
    </main>
  );
}
