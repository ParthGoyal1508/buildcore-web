import PageHeader from '@/app/ui/page-header';
import { SignatoriesScreen } from '@/app/ui/settings/signatories-screen';

export const metadata = { title: 'Signatories' };

export default function SignatoriesPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Signatories"
        description="Who signs letters, and the signature applied to them."
      />
      <SignatoriesScreen />
    </main>
  );
}
