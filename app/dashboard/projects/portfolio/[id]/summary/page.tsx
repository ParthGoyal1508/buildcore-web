'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getProject } from '@/app/lib/api/projects';
import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import FinancialsGuard from '@/app/ui/projects/financials-guard';
import ProjectSummary from '@/app/ui/projects/project-summary';

/** One project's revenue, cost, budget and labour for a month (018 US3 — `bugs.md` items 11, 14). */
export default function ProjectSummaryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: project } = useQuery({
    queryKey: ['projects', 'portfolio', id],
    queryFn: () => getProject(id),
  });

  return (
    <FinancialsGuard>
      <main>
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-600">
          <Link
            href={ROUTES.projectsPortfolio}
            className="hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Portfolio
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-gray-900">{project?.name ?? 'Summary'}</span>
        </nav>

        <PageHeader
          title={project ? `${project.name} — position` : 'Project position'}
          className="mb-6"
        />

        <ProjectSummary projectId={id} projectName={project?.name} />
      </main>
    </FinancialsGuard>
  );
}
