'use client';

import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';

const TILES = [
  {
    name: 'Wage Rates',
    href: ROUTES.labourWageRates,
    description: 'Per-project daily rates by skill category, effective-dated.',
  },
  {
    name: 'Workers',
    href: ROUTES.labourWorkers,
    description: 'The labour registry — direct and contractor-engaged.',
  },
  {
    name: 'Gangs',
    href: ROUTES.labourGangs,
    description: 'Group workers under a leader for faster muster capture.',
  },
  {
    name: 'Musters',
    href: ROUTES.labourMusters,
    description: 'Review and approve submitted attendance.',
  },
  {
    name: 'Payment Sheets',
    href: ROUTES.labourPaymentSheets,
    description: 'Generate, approve and disburse cash payment sheets.',
  },
  {
    name: 'Advances',
    href: ROUTES.labourAdvances,
    description: 'Advances against wages and their recovery.',
  },
];

export default function LabourIndexPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Labour</h1>
      <p className="mb-6 text-sm text-gray-500">
        Wage masters, the worker registry, supervisor attendance and cash payment
        sheets.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <h2 className="text-sm font-semibold text-gray-900">{tile.name}</h2>
            <p className="mt-1 text-xs text-gray-500">{tile.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
