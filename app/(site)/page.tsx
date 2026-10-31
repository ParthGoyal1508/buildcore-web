import { ArrowRightIcon } from '@heroicons/react/24/outline';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  CLIENTS,
  COMPANY,
  COMPLETED_PROJECTS,
  JOURNEY,
  ONGOING_PROJECTS,
  SITE_URL,
  VERTICALS,
} from '@/app/lib/site-content';
import { ClientGrid, SectionHeading, VERTICAL_ICONS } from '@/app/ui/site/blocks';
import InstalledAppRedirect from '@/app/ui/site/installed-app-redirect';

export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} — ${COMPANY.tagline}` },
  description:
    'Tirupati Enterprises, Deoli (Tonk), builds and maintains roads, state and national highways and public buildings across Rajasthan for NHAI, MoRTH, PWD and leading developers.',
};

const STATS = [
  { value: COMPLETED_PROJECTS.length, label: 'Projects completed' },
  { value: ONGOING_PROJECTS.length, label: 'Projects ongoing' },
  { value: CLIENTS.length, label: 'Clients served' },
  { value: VERTICALS.length, label: 'Business verticals' },
];

/** Lets search engines show the business's address and phone (schema.org GeneralContractor). */
const BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'GeneralContractor',
  name: COMPANY.name,
  url: SITE_URL,
  logo: `${SITE_URL}/site/tirupati-logo.png`,
  telephone: COMPANY.phones[0],
  email: COMPANY.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Tirupati House, Ward No. 13, Gaurav Path Road',
    addressLocality: 'Deoli',
    addressRegion: 'Rajasthan',
    postalCode: '304804',
    addressCountry: 'IN',
  },
  areaServed: 'Rajasthan',
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BUSINESS_JSON_LD) }}
      />
      <InstalledAppRedirect />

      <section className="relative overflow-hidden bg-brand-600 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-[45%] bg-brand-500 lg:block"
          style={{ clipPath: 'polygon(28% 0, 100% 0, 100% 100%, 0 100%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-[38%] hidden w-3 -skew-x-[14deg] bg-amber-500 lg:block"
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:py-28">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
              Deoli · Tonk · Rajasthan
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              Building the roads and infrastructure Rajasthan runs on.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-brand-100">
              Roads, state and national highways, public buildings and highway maintenance —
              delivered for NHAI, MoRTH, PWD and India’s leading infrastructure developers.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-brand-900 shadow-sm hover:bg-amber-400"
              >
                Our Projects
                <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Contact Us
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px self-end overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/15">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-brand-700/80 p-6 backdrop-blur">
                <dt className="text-sm text-brand-200">{stat.label}</dt>
                <dd className="mt-1 text-4xl font-bold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <SectionHeading id="journey" eyebrow="Our Journey" title="From Deoli to the national highways" />
        <div className="space-y-5 text-base leading-7 text-gray-600">
          {JOURNEY.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <Link href="/about" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-500">
            More about us <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Verticals" title="What we build" />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERTICALS.map((vertical) => {
              const Icon = VERTICAL_ICONS[vertical.key];
              return (
                <li key={vertical.key}>
                  <Link
                    href={`/verticals#${vertical.key}`}
                    className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-white">
                      <Icon aria-hidden="true" className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold text-gray-900">{vertical.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{vertical.summary}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:text-brand-500">
                      Learn more <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading
            id="clients"
            eyebrow="Our Clients"
            title="Trusted by government and industry"
            intro="Central and state government departments and India’s leading infrastructure developers."
          />
          <div className="mt-10">
            <ClientGrid />
          </div>
        </div>
      </section>

      <section className="bg-brand-600">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Have a project in mind?</h2>
            <p className="mt-2 text-brand-100">Talk to our team about your next road, highway or building.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-brand-900 hover:bg-amber-400"
          >
            Get in touch <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
