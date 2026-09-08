import type { Metadata } from 'next';
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

export const metadata: Metadata = { title: 'Partners' };

const SECTIONS: Tile[] = [
  {
    name: 'Vendors',
    href: ROUTES.partnersVendors,
    icon: BuildingStorefrontIcon,
    description:
      'Suppliers, hirers and subcontractors, with their GST and TDS terms.',
  },
  {
    name: 'Contractors',
    href: ROUTES.partnersContractors,
    icon: ShieldCheckIcon,
    description:
      'The compliance vault for vendors who supply labour: registrations, documents and expiry.',
  },
  {
    name: 'Compliance',
    href: ROUTES.partnersCompliance,
    icon: ClipboardDocumentCheckIcon,
    description: 'Monthly PF and ESIC filings, and the verification trail.',
  },
  {
    name: 'RAG matrix',
    href: ROUTES.partnersRag,
    icon: TableCellsIcon,
    description: 'One financial year of filings, every contractor, at a glance.',
  },
  {
    name: 'BOCW cess',
    href: ROUTES.partnersBocw,
    icon: BanknotesIcon,
    description: 'Cess liability per project and the payments made against it.',
  },
];

export default function PartnersPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Partners"
        description="Vendors and the contractor compliance record."
      />
      <TileGrid tiles={SECTIONS} />
    </main>
  );
}
