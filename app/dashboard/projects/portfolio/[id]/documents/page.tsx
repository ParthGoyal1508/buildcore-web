'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getProject } from '@/app/lib/api/projects';
import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import ProjectDocumentsPanel from '@/app/ui/projects/project-documents-panel';

/**
 * One project's papers (017 US2 T014, FR-024 T077/T078).
 *
 * A screen of its own rather than a section of the edit form, because reading what a project holds
 * and changing what the project *is* are different jobs with different audiences — and the edit
 * form is behind the project lock, which has nothing to do with whether somebody may look at a
 * filed document.
 */
export default function ProjectDocumentsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: project } = useQuery({
    queryKey: ['projects', 'portfolio', id],
    queryFn: () => getProject(id),
  });

  return (
    <main>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-600">
        <Link
          href={ROUTES.projectsPortfolio}
          className="hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Portfolio
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-gray-900">{project?.name ?? 'Documents'}</span>
      </nav>

      <PageHeader
        title={project ? project.name : 'Project documents'}
        className="mb-6"
      />

      <ProjectDocumentsPanel projectId={id} />
    </main>
  );
}
