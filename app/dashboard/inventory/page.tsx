import type { Metadata } from 'next';
import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

export const metadata: Metadata = { title: 'Inventory' };

const SECTIONS: Tile[] = [
  {
    name: 'Stock',
    href: ROUTES.inventoryStock,
    icon: ArchiveBoxIcon,
    description:
      'What is where, at what average rate, and what has fallen below its reorder level.',
  },
  {
    name: 'Purchases',
    href: ROUTES.inventoryPurchases,
    icon: ShoppingCartIcon,
    description:
      'Material received, with its bill, GRN number and payment status.',
  },
  {
    name: 'Issues',
    href: ROUTES.inventoryIssues,
    icon: ArrowUpTrayIcon,
    description: 'Material issued from a store to work.',
  },
  {
    name: 'Transfers',
    href: ROUTES.inventoryTransfers,
    icon: ArrowsRightLeftIcon,
    description: 'Material moved between stores, and where it is now.',
  },
  {
    name: 'Payments',
    href: ROUTES.inventoryPayments,
    icon: BanknotesIcon,
    description:
      "Payments to vendors, allocated automatically against their oldest bills.",
  },
  {
    name: 'Indents',
    href: ROUTES.inventoryIndents,
    icon: ClipboardDocumentListIcon,
    description:
      'What sites have asked for, what was approved, and what is still outstanding.',
  },
];

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Material in, material out, and what each store is holding."
      />
      <TileGrid tiles={SECTIONS} />
    </div>
  );
}
