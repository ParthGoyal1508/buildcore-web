import { LetterKindsScreen } from '@/app/ui/settings/letter-kinds-screen';
import PageHeader from '@/app/ui/page-header';
import { CompanyProvider } from '@/app/ui/settings/company-context';

export const metadata = { title: 'Letter kinds' };

/**
 * Wrapped in `CompanyProvider` (017 FR-021).
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
      <CompanyProvider>
        <LetterKindsScreen />
      </CompanyProvider>
    </main>
  );
}
