'use client';

import { ROUTES } from '@/app/lib/constants';
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
  { name: 'Stock', href: ROUTES.inventoryStock },
  { name: 'Purchases', href: ROUTES.inventoryPurchases },
  { name: 'Issues', href: ROUTES.inventoryIssues },
  { name: 'Transfers', href: ROUTES.inventoryTransfers },
  { name: 'Payments', href: ROUTES.inventoryPayments },
  { name: 'Indents', href: ROUTES.inventoryIndents },
];

export default function InventoryNav() {
  return <SectionTabs label="Inventory sections" tabs={TABS} />;
}
