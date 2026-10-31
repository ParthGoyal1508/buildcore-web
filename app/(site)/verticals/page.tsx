import type { Metadata } from 'next';

import { COMPLETED_PROJECTS, ONGOING_PROJECTS, VERTICALS } from '@/app/lib/site-content';
import { PageHero, ProjectList, VERTICAL_ICONS } from '@/app/ui/site/blocks';

export const metadata: Metadata = {
  title: 'Verticals',
  description: 'Road, highway, building and operation & maintenance works by Tirupati Enterprises.',
};

const ALL_PROJECTS = [...ONGOING_PROJECTS, ...COMPLETED_PROJECTS];

export default function VerticalsPage() {
  return (
    <>
      <PageHero
        eyebrow="Verticals"
        title="Four lines of work, one standard"
        intro="Every vertical is run by the same team, the same equipment and the same commitment to quality and safety."
      />
      {VERTICALS.map((vertical, i) => {
        const Icon = VERTICAL_ICONS[vertical.key];
        const projects = ALL_PROJECTS.filter((p) => p.vertical === vertical.key);
        return (
          <section key={vertical.key} id={vertical.key} className={i % 2 ? 'scroll-mt-20 bg-gray-50' : 'scroll-mt-20'}>
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Icon aria-hidden="true" className="h-7 w-7" />
                </span>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{vertical.title}</h2>
                <p className="mt-4 leading-7 text-gray-600">{vertical.body}</p>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Projects ({projects.length})
                </h3>
                <ProjectList projects={projects} />
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
