import { LetterKindsScreen } from '@/app/ui/settings/letter-kinds-screen';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Letter kinds' };

export default function LetterKindsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Letter Kinds"
        description="The kinds of letter this company issues. Adding one needs no release."
      />
      <LetterKindsScreen />
    </main>
  );
}
