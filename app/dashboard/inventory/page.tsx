import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';

export const metadata: Metadata = { title: 'Inventory' };

const SECTIONS = [
  {
    name: 'Stock',
    href: ROUTES.inventoryStock,
    description:
      'What is where, at what average rate, and what has fallen below its reorder level.',
  },
  {
    name: 'Purchases',
    href: ROUTES.inventoryPurchases,
    description:
      'Material received, with its bill, GRN number and payment status.',
  },
  {
    name: 'Issues',
    href: ROUTES.inventoryIssues,
    description: 'Material issued from a store to work.',
  },
  {
    name: 'Transfers',
    href: ROUTES.inventoryTransfers,
    description: 'Material moved between stores, and where it is now.',
  },
  {
    name: 'Payments',
    href: ROUTES.inventoryPayments,
    description:
      "Payments to vendors, allocated automatically against their oldest bills.",
  },
  {
    name: 'Indents',
    href: ROUTES.inventoryIndents,
    description:
      'What sites have asked for, what was approved, and what is still outstanding.',
  },
];

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className={`${lusitana.className} text-2xl`}>Inventory</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <h2 className="text-sm font-semibold text-gray-900">
              {section.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
