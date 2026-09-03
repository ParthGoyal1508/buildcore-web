'use client';

import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import ProjectForm from '@/app/ui/projects/project-form';

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
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>New project</h1>
      <ProjectForm />
    </main>
  );
}
