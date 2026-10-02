'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getProject } from '@/app/lib/api/projects';
import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import BillSheet from '@/app/ui/projects/bill-sheet';
import ClientBillsList from '@/app/ui/projects/client-bills-list';
import FinancialsGuard from '@/app/ui/projects/financials-guard';

/**
 * Client bills for one project (018 US1 — `bugs.md` item 11).
 *
 * The sheet above and the history below, on one screen deliberately: the cumulative quantity a
 * biller measures against comes from the bills beneath it, and splitting them across two pages would
 * mean checking one against the other from memory.
 */
export default function ProjectBillingPage() {
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
          <span className="text-gray-900">{project?.name ?? 'Billing'}</span>
        </nav>

        <PageHeader
          title={project ? `${project.name} — client bills` : 'Client bills'}
          className="mb-6"
        />

        <div className="flex flex-col gap-10">
          <BillSheet projectId={id} />
          <ClientBillsList projectId={id} />
        </div>
      </main>
    </FinancialsGuard>
  );
}
