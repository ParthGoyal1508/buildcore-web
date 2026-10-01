import { LetterKindsScreen } from '@/app/ui/settings/letter-kinds-screen';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Letter kinds' };

/**
 * Company scope comes from the session (019 FR-004); the screen sends nothing.
 *
 * Per page rather than on `app/dashboard/settings/layout.tsx`: that layout wraps every
 * settings section, and `employee-setup` already mounts its own provider — hoisting would
 * render two company selectors on that page. Feature 019 replaces this with one
 * application-wide switcher and these wrappers come out then.
 */
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
