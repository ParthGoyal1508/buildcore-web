import PageHeader from '@/app/ui/page-header';
import { ProjectDocumentsScreen } from '@/app/ui/settings/project-documents-screen';

export const metadata = { title: 'Project documents' };

export default function ProjectDocumentsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Project Documents"
        description="Which documents a project must hold before it counts as fully papered."
      />
      <ProjectDocumentsScreen />
    </main>
  );
}
