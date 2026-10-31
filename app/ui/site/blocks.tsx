import {
  BuildingOffice2Icon,
  MapIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Image from 'next/image';

import { CLIENTS, VERTICALS, type Project, type VerticalKey } from '@/app/lib/site-content';

export const VERTICAL_ICONS: Record<VerticalKey, typeof MapIcon> = {
  road: MapIcon,
  highway: TruckIcon,
  building: BuildingOffice2Icon,
  om: WrenchScrewdriverIcon,
};

const VERTICAL_TITLES = Object.fromEntries(VERTICALS.map((v) => [v.key, v.title]));

/** The navy band that opens every inner page, with the letterhead's slanted edge. */
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="relative overflow-hidden bg-brand-600 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 hidden w-1/3 bg-brand-500 md:block"
        style={{ clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%)' }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-base text-brand-100 sm:text-lg">{intro}</p>}
      </div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  className?: string;
}) {
  return (
    <div id={id} className={clsx('max-w-3xl scroll-mt-28', className)}>
      <p className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-brand-400">
        <span aria-hidden="true" className="h-0.5 w-8 bg-amber-500" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-base leading-7 text-gray-600">{intro}</p>}
    </div>
  );
}

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <ol className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {projects.map((project, i) => {
        const Icon = VERTICAL_ICONS[project.vertical];
        return (
          <li key={project.name} className="flex gap-4 p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium leading-6 text-gray-900">{project.name}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span>{project.client}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {VERTICAL_TITLES[project.vertical]}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ClientGrid() {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {CLIENTS.map((client) => (
        <li
          key={client.logo}
          className="flex aspect-[4/3] items-center justify-center rounded-xl border border-gray-200 bg-white p-3"
          title={client.name}
        >
          <Image
            src={`/site/clients/${client.logo}`}
            alt={client.name}
            width={240}
            height={180}
            className="max-h-full w-auto object-contain"
          />
        </li>
      ))}
    </ul>
  );
}
