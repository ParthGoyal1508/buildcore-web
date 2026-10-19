'use client';


import { ROUTES } from '@/app/lib/constants';
import ProjectForm from '@/app/ui/projects/project-form';
import PageHeader from '@/app/ui/page-header';

/** Create a project (spec US3). */
export default function NewProjectPage() {
  return (
    <main>
      <PageHeader
        title="New project"
        breadcrumbs={[{ label: 'Portfolio', href: ROUTES.projectsPortfolio }]}
        className="mb-6"
      />
      <ProjectForm />
    </main>
  );
}
