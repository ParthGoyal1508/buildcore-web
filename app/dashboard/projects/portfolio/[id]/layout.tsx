'use client';

import { LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getProjectDetail } from '@/app/lib/api/projects';
import { getCurrentUser } from '@/app/lib/api/users';
import { PROJECT_SHELL_COPY, ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import SectionTabs from '@/app/ui/section-tabs';
import StatusBadge from '@/app/ui/status-badge';
import { visibleProjectDetailSections } from '@/app/ui/projects/project-detail-sections';
import { ProjectLockProvider } from '@/app/ui/projects/project-lock-context';
import { ProjectShellProvider } from '@/app/ui/projects/project-shell-context';

/**
 * The shell every section of one project renders inside (008 US4).
 *
 * ## What this replaced
 *
 * Six sections existed as six routes and nothing joined them. Each page fetched the project
 * for itself, drew its own `Portfolio / <name>` breadcrumb and its own `<name> — <section>`
 * heading, and offered no way to any of the other five: from the BOQ, reaching the documents
 * meant going back to the portfolio list and finding the row again. The row carried six links
 * because of it — a comment in `project-list-table.tsx` said so outright, *"reachable from the
 * row rather than from a project detail page that does not exist"*.
 *
 * ## Routed sections, not the nine hash tabs US4 specified
 *
 * tasks.md T022 asks for one page with a sticky nine-tab strip navigating by URL hash. The
 * sections are routes instead, because four of them (BOQ, documents, billing, subcontractors)
 * had already been built that way and because a hash is not a location: it cannot be linked to
 * from a reminder, reloaded onto the tab you were reading, or opened in a second window beside
 * the first. The strip stays; it just moves between routes.
 *
 * ## One request
 *
 * `GET /projects/:id` returns the project *and* its people, machinery, materials and three
 * summaries. This app parsed the first field and discarded the rest for a year. The layout now
 * fetches it once, under the key the section pages already used, and hands it down through
 * `ProjectShellProvider` — so the tab strip costs one request for all ten sections rather than
 * one per section, and People, Machinery and Materials need no endpoint of their own.
 */
export default function ProjectShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const {
    data: detail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['projects', 'portfolio', id],
    queryFn: () => getProjectDetail(id),
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        {PROJECT_SHELL_COPY.loading}
      </p>
    );
  }

  // No project means no shell: a tab strip over a project that could not be loaded would offer
  // ten links to pages that would each fail the same way.
  if (isError || !detail) {
    return (
      <main>
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-600">
          <Link
            href={ROUTES.projectsPortfolio}
            className="hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {PROJECT_SHELL_COPY.breadcrumb}
          </Link>
        </nav>
        <p role="alert" className="text-sm text-red-600">
          {PROJECT_SHELL_COPY.loadFailed}
        </p>
      </main>
    );
  }

  const project = detail.project;
  const tabs = visibleProjectDetailSections(user, id);

  return (
    <ProjectShellProvider detail={detail}>
      <ProjectLockProvider projectId={project.id} isLocked={project.isLocked}>
        <main>
          <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-600">
            <Link
              href={ROUTES.projectsPortfolio}
              className="hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              {PROJECT_SHELL_COPY.breadcrumb}
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-gray-900">{project.name}</span>
          </nav>

          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                {project.name}
                {project.isLocked && (
                  <LockClosedIcon
                    className="w-5 shrink-0 text-gray-500"
                    // Announced, not decorative: the lock is the reason half the controls
                    // under it refuse to save.
                    aria-label="Locked"
                    role="img"
                  />
                )}
              </span>
            }
            description={
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{project.code}</span>
                {project.location && <span>{project.location}</span>}
                <StatusBadge status={project.status} />
              </span>
            }
          />

          {project.isLocked && (
            <p
              role="status"
              className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              {PROJECT_SHELL_COPY.locked}
            </p>
          )}

          {tabs.length > 0 && (
            <SectionTabs
              label={PROJECT_SHELL_COPY.tabsLabel}
              tabs={tabs}
              className="mt-4"
            />
          )}

          <div className="mt-6">{children}</div>
        </main>
      </ProjectLockProvider>
    </ProjectShellProvider>
  );
}
