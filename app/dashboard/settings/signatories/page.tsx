import PageHeader from '@/app/ui/page-header';
import { SignatoriesScreen } from '@/app/ui/settings/signatories-screen';

export const metadata = { title: 'Signatories' };

/**
 * Company scope comes from the session (019 FR-004); the screen sends nothing.
 *
 * Per page rather than on `app/dashboard/settings/layout.tsx`: that layout wraps every
 * settings section, and `employee-setup` already mounts its own provider — hoisting would
 * render two company selectors on that page. Feature 019 replaces this with one
 * application-wide switcher and these wrappers come out then.
 */
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
