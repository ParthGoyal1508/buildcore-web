import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';

export const metadata: Metadata = { title: 'Partners' };

const SECTIONS = [
  {
    name: 'Vendors',
    href: ROUTES.partnersVendors,
    description:
      'Suppliers, hirers and subcontractors, with their GST and TDS terms.',
  },
  {
    name: 'Contractors',
    href: ROUTES.partnersContractors,
    description:
      'The compliance vault for vendors who supply labour: registrations, documents and expiry.',
  },
  {
    name: 'Compliance',
    href: ROUTES.partnersCompliance,
    description: 'Monthly PF and ESIC filings, and the verification trail.',
  },
  {
    name: 'RAG matrix',
    href: ROUTES.partnersRag,
    description: 'One financial year of filings, every contractor, at a glance.',
  },
  {
    name: 'BOCW cess',
    href: ROUTES.partnersBocw,
    description: 'Cess liability per project and the payments made against it.',
  },
];

export default function PartnersPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>Partners</h1>
      <p className="mb-6 text-sm text-gray-600">
        Vendors and the contractor compliance record.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-gray-200 p-4 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <h2 className="font-medium text-gray-900">{section.name}</h2>
            <p className="mt-1 text-sm text-gray-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
