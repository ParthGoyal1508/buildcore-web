'use client';

import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';
import ProjectForm from '@/app/ui/projects/project-form';
import PageHeader from '@/app/ui/page-header';

/** Create a project (spec US3). */
export default function NewProjectPage() {
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
        <span className="text-gray-900">New project</span>
      </nav>
      <PageHeader title="New project" className="mb-6" />
      <ProjectForm />
    </main>
  );
}
