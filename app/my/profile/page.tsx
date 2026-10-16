import type { Metadata } from 'next';

import MyProfile from '@/app/ui/my/my-profile';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'My profile' };

export default function Page() {
  return (
    <main>
      <PageHeader title="My profile" className="mb-4" />
      <MyProfile />
    </main>
  );
}
