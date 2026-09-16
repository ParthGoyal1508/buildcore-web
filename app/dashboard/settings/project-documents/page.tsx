import PageHeader from '@/app/ui/page-header';
import { CompanyProvider } from '@/app/ui/settings/company-context';
import { ProjectDocumentsScreen } from '@/app/ui/settings/project-documents-screen';

export const metadata = { title: 'Project documents' };

/**
 * Wrapped in `CompanyProvider` (017 FR-021).
 *
 * Per page rather than on `app/dashboard/settings/layout.tsx`: that layout wraps every
 * settings section, and `employee-setup` already mounts its own provider — hoisting would
 * render two company selectors on that page. Feature 019 replaces this with one
 * application-wide switcher and these wrappers come out then.
 */
export default function ProjectDocumentsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Project Documents"
        description="Which documents a project must hold before it counts as fully papered."
      />
      <CompanyProvider>
        <ProjectDocumentsScreen />
      </CompanyProvider>
    </main>
  );
}
