import { CheckCircleIcon, EyeIcon, FlagIcon } from '@heroicons/react/24/outline';
import type { Metadata } from 'next';

import { HSE, MISSION, STRENGTHS, VISION } from '@/app/lib/site-content';
import { PageHero, SectionHeading } from '@/app/ui/site/blocks';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'The vision, mission, HSE commitment and strengths of Tirupati Enterprises.',
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Us"
        title="Built on delivery, driven by safety"
        intro="A Rajasthan infrastructure contractor delivering roads, highways and public buildings for government and industry."
      />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading id="vision" eyebrow="Vision & Mission" title="Where we are going" />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-brand-600 p-8 text-white">
            <EyeIcon aria-hidden="true" className="h-8 w-8 text-amber-400" />
            <h3 className="mt-4 text-xl font-semibold">Our Vision</h3>
            <p className="mt-3 leading-7 text-brand-100">{VISION}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-8">
            <FlagIcon aria-hidden="true" className="h-8 w-8 text-brand-600" />
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Our Mission</h3>
            <ul className="mt-3 space-y-3">
              {MISSION.map((point) => (
                <li key={point} className="flex gap-3 leading-7 text-gray-600">
                  <CheckCircleIcon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-amber-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading id="hse" eyebrow="HSE" title="Health, Safety & Environment" intro={HSE.intro} />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {HSE.points.map((point) => (
              <li key={point.title} className="rounded-xl border-t-4 border-amber-500 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{point.title}</h3>
                <p className="mt-2 leading-7 text-gray-600">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading id="strength" eyebrow="Our Strength" title="Why clients choose us" />
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STRENGTHS.map((strength, i) => (
            <li key={strength.title} className="rounded-xl border border-gray-200 p-6">
              <span className="text-3xl font-bold text-brand-200">0{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold text-gray-900">{strength.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{strength.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
