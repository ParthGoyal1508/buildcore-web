'use client';

import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  CameraIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import {
  INVENTORY_ISSUE_LABEL,
  ROUTES,
  SITE_ENTRY_COPY,
} from '@/app/lib/constants';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

const SECTIONS: Tile[] = [
  {
    name: 'Stock',
    href: ROUTES.inventoryStock,
    icon: ArchiveBoxIcon,
    description:
      'What is where, at what average rate, and what has fallen below its reorder level.',
  },
  {
    name: 'Purchase orders',
    href: ROUTES.inventoryPurchaseOrders,
    icon: DocumentTextIcon,
    description:
      'Orders placed on a vendor for items from the item master — approved, then issued as a PDF.',
  },
  {
    name: 'Purchases',
    href: ROUTES.inventoryPurchases,
    icon: ShoppingCartIcon,
    description:
      'Material received, with its bill, GRN number and payment status.',
  },
  {
    name: INVENTORY_ISSUE_LABEL,
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
      'Payments to vendors, allocated automatically against their oldest bills.',
  },
  {
    name: 'Indents',
    href: ROUTES.inventoryIndents,
    icon: ClipboardDocumentListIcon,
    description:
      'What sites have asked for, what was approved, and what is still outstanding.',
  },
];

/** The site's delivery entry (043), first for those who hold `INVENTORY_SITE_ENTRY`. */
const SITE_ENTRY: Tile = {
  name: SITE_ENTRY_COPY.title,
  href: ROUTES.inventorySiteEntry,
  icon: CameraIcon,
  description:
    'Record a delivery at your site with live photos. Head Office completes it.',
};

/**
 * The Inventory index's tiles. A client component because the site entry tile depends on the
 * caller's permissions, read from the `['currentUser']` query the layout guard already made — and
 * it joins the one grid rather than sitting in a row of its own.
 */
export default function InventoryTiles() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const tiles = user?.permissions.includes('INVENTORY_SITE_ENTRY')
    ? [SITE_ENTRY, ...SECTIONS]
    : SECTIONS;
  return <TileGrid tiles={tiles} />;
}
