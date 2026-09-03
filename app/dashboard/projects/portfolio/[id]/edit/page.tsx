'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getProject } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import ProjectForm from '@/app/ui/projects/project-form';
import { ProjectLockProvider } from '@/app/ui/projects/project-lock-context';

/** Edit a project, including its lock (spec US3, FR-003). */
export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: project, isLoading, isError } = useQuery({
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
        <span className="text-gray-900">{project?.name ?? 'Edit project'}</span>
      </nav>

      <h1 className={`${lusitana.className} mb-6 text-2xl`}>
        {project ? project.name : 'Edit project'}
      </h1>

      {isLoading && (
        <p className="text-sm text-gray-500" role="status">
          Loading…
        </p>
      )}
      {isError && (
        <p className="text-sm text-red-600" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}

      {project && (
        <>
          {project.isLocked && (
            <p
              role="status"
              className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              {MESSAGES.projectLocked}
            </p>
          )}
          {/* The provider is mounted here so the lock reaches the tab components
              User Story 4 adds, without those having to fetch the project again.
              Nothing under it consumes the lock yet — the form owns the toggle
              itself and deliberately stays editable while locked, since unlocking
              is a write to the project. */}
          <ProjectLockProvider projectId={project.id} isLocked={project.isLocked}>
            <ProjectForm project={project} />
          </ProjectLockProvider>
        </>
      )}
    </main>
  );
}
