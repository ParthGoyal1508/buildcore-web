'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getProject } from '@/app/lib/api/projects';
import { BOQ_COPY, ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import BoqAlertTabs from '@/app/ui/projects/boq-alert-tabs';
import BoqEntry from '@/app/ui/projects/boq-entry';
import BoqImport from '@/app/ui/projects/boq-import';
import BoqTree from '@/app/ui/projects/boq-tree';
import { ProjectLockProvider } from '@/app/ui/projects/project-lock-context';

/**
 * The BOQ for one project (008 US5, amended 2026-10-03).
 *
 * **The reason this page exists at all**: nothing in either repository could create a BOQ, so
 * 018's billing screens have been measuring against a table nothing could fill. Client bills, the
 * P&L and the monthly position were all built and all unusable.
 *
 * Import above entry above the schedule, in that order. A tender arrives as a file far more often
 * than it arrives line by line, so the import is what somebody is looking for on a project with no
 * BOQ — and the schedule below is what they check immediately afterwards.
 *
 * `PROJECTS` gates this page rather than `PROJECT_FINANCIALS`: the schedule carries rates, but it
 * is the list of what is to be built, and a site engineer who may not open a bill may certainly
 * need to read it. No `FinancialsGuard` here, unlike the billing pages next door.
 */
export default function ProjectBoqPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: project } = useQuery({
    queryKey: ['projects', 'portfolio', id],
    queryFn: () => getProject(id),
  });

  return (
    <ProjectLockProvider projectId={id} isLocked={project?.isLocked ?? false}>
      <main>
        <nav aria-label="Breadcrumb" className="mb-2 text-sm text-gray-600">
          <Link
            href={ROUTES.projectsPortfolio}
            className="hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Portfolio
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-gray-900">{project?.name ?? BOQ_COPY.heading}</span>
        </nav>

        <PageHeader
          title={project ? `${project.name} — ${BOQ_COPY.heading}` : BOQ_COPY.heading}
          description={BOQ_COPY.subheading}
          className="mb-6"
        />

        <div className="flex flex-col gap-8">
          <BoqImport projectId={id} />
          <BoqEntry projectId={id} />
          <BoqTree projectId={id} />
          <BoqAlertTabs projectId={id} />
        </div>
      </main>
    </ProjectLockProvider>
  );
}
