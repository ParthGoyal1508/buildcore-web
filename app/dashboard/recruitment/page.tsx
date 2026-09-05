'use client';

import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';

const TILES = [
  { name: 'Requisitions', href: ROUTES.recruitmentRequisitions, description: 'Open positions and approvals.' },
  { name: 'Pipeline', href: ROUTES.recruitmentPipeline, description: 'Candidates through Interviews, Selected and Joining Pending.' },
  { name: 'Interviews', href: ROUTES.recruitmentInterviews, description: "Today's and upcoming rounds, with feedback." },
  { name: 'Letter Templates', href: ROUTES.recruitmentLetterTemplates, description: 'Per-company templates with tokens.' },
  { name: 'Letters', href: ROUTES.recruitmentLetters, description: 'Generated letters with version history.' },
  { name: 'Resignations', href: ROUTES.recruitmentResignations, description: 'Separations and last working days.' },
];

export default function RecruitmentIndexPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Recruitment & Onboarding</h1>
      <p className="mb-6 text-sm text-gray-500">
        The hiring funnel from an open position to a joined, onboarded employee.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
            <p className="mt-1 text-xs text-gray-500">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
