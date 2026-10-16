import type { Metadata } from 'next';

import MyTaxDeclaration from '@/app/ui/my/my-tax-declaration';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Tax declaration' };

export default function Page() {
  return (
    <main>
      <PageHeader title="Tax declaration" className="mb-4" />
      <MyTaxDeclaration />
    </main>
  );
}
