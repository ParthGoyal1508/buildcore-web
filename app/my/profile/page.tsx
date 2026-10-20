import type { Metadata } from 'next';

import MyProfile from '@/app/ui/my/my-profile';
import InstallAppCard from '@/app/ui/install-app-card';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'My profile' };

export default function Page() {
  return (
    <main>
      <PageHeader title="My profile" className="mb-4" />
      <MyProfile />
      {/* 036: the `/my` shell has no Settings, so its users install the app from here. */}
      <div className="mt-6">
        <InstallAppCard />
      </div>
    </main>
  );
}
