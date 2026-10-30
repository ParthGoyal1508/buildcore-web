'use client';

import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  ScaleIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';

import {
  AGREED_RATE_COPY,
  DAILY_RATE_COPY,
  OPENING_STOCK_COPY,
  INVENTORY_ISSUE_LABEL_SHORT,
  ROUTES,
} from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Inventory.
 *
 * Every tab here needs `INVENTORY`, which `ModuleGuard` has already established for
 * the whole subtree — so unlike the Partners strip, nothing is filtered out. The
 * item and category masters are the exception and they are deliberately *not* a
 * tab: they are a Settings-owned master reached from a button on the Stock screen,
 * so a user without `SETTINGS` never sees a tab they cannot open.
 */
const TABS = [
  { name: 'Stock', href: ROUTES.inventoryStock, icon: ArchiveBoxIcon },
  {
    name: 'Purchase orders',
    href: ROUTES.inventoryPurchaseOrders,
    icon: DocumentTextIcon,
  },
  {
    name: 'Purchases',
    href: ROUTES.inventoryPurchases,
    icon: ShoppingCartIcon,
  },
  // 028 FR-030: the label only. `ROUTES.inventoryIssues` is unchanged, because renaming a URL
  // breaks every link already sent for no gain anybody can see.
  {
    name: INVENTORY_ISSUE_LABEL_SHORT,
    href: ROUTES.inventoryIssues,
    icon: ArrowUpTrayIcon,
  },
  {
    name: 'Transfers',
    href: ROUTES.inventoryTransfers,
    icon: ArrowsRightLeftIcon,
  },
  {
    name: 'Payments',
    href: ROUTES.inventoryPayments,
    icon: BanknotesIcon,
  },
  {
    name: 'Indents',
    href: ROUTES.inventoryIndents,
    icon: ClipboardDocumentListIcon,
  },
  // 050: diesel, cement — the items priced day by day.
  {
    name: DAILY_RATE_COPY.tab,
    href: ROUTES.inventoryDailyRates,
    icon: CurrencyRupeeIcon,
  },
  // 051: the rates purchases are held to, and the stock each store started with.
  {
    name: AGREED_RATE_COPY.tab,
    href: ROUTES.inventoryAgreedRates,
    icon: ScaleIcon,
  },
  {
    name: OPENING_STOCK_COPY.tab,
    href: ROUTES.inventoryOpeningStock,
    icon: InboxArrowDownIcon,
  },
];

export default function InventoryNav({
  stripHidden = false,
}: {
  stripHidden?: boolean;
} = {}) {
  return (
    <SectionTabs
      label="Inventory sections"
      tabs={TABS}
      mobile
      stripHidden={stripHidden}
    />
  );
}
