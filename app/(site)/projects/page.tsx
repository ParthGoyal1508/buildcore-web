import type { Metadata } from 'next';

import { COMPLETED_PROJECTS, ONGOING_PROJECTS } from '@/app/lib/site-content';
import { PageHero, ProjectList, SectionHeading } from '@/app/ui/site/blocks';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Completed and ongoing road, highway and building projects by Tirupati Enterprises.',
};

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        eyebrow="Projects"
        title="Our work across Rajasthan"
        intro={`${ONGOING_PROJECTS.length} projects under way and ${COMPLETED_PROJECTS.length} handed over, for central and state government departments.`}
      />
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <SectionHeading id="ongoing" eyebrow="Ongoing Projects" title="Under construction" />
        <div className="mt-8">
          <ProjectList projects={ONGOING_PROJECTS} />
        </div>
      </section>
      <section className="bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <SectionHeading id="completed" eyebrow="Completed Projects" title="Delivered" />
          <div className="mt-8">
            <ProjectList projects={COMPLETED_PROJECTS} />
          </div>
        </div>
      </section>
    </>
  );
}
