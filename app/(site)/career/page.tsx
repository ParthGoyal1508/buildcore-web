import { AcademicCapIcon, BriefcaseIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import type { Metadata } from 'next';

import { COMPANY } from '@/app/lib/site-content';
import { PageHero } from '@/app/ui/site/blocks';

export const metadata: Metadata = {
  title: 'Career',
  description: 'Build your career in roads, highways and buildings with Tirupati Enterprises.',
};

const REASONS = [
  { icon: BriefcaseIcon, title: 'Real projects', body: 'Work on national highways, state roads and public buildings from day one.' },
  { icon: AcademicCapIcon, title: 'Learn on site', body: 'Grow alongside experienced engineers and site managers.' },
  { icon: ShieldCheckIcon, title: 'Safe workplace', body: 'Safety equipment, training and timely salaries for every team member.' },
];

export default function CareerPage() {
  return (
    <>
      <PageHero
        eyebrow="Career"
        title="Build your career with us"
        intro="We are always looking for engineers, supervisors, operators and skilled workers who take pride in their work."
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ul className="grid gap-6 md:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-gray-200 p-6">
              <Icon aria-hidden="true" className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl bg-brand-600 p-8 text-white sm:p-10">
          <h2 className="text-xl font-semibold sm:text-2xl">Send us your CV</h2>
          <p className="mt-2 max-w-2xl text-brand-100">
            Tell us the role you are interested in and your experience, and our team will get in touch
            with you.
          </p>
          <a
            href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('Job application')}`}
            className="mt-6 inline-flex rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-brand-900 hover:bg-amber-400"
          >
            Email your CV
          </a>
        </div>
      </section>
    </>
  );
}
