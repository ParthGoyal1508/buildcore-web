import type { Metadata } from 'next';

import InventoryTiles from '@/app/ui/inventory/inventory-tiles';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Inventory' };

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Material in, material out, and what each store is holding."
      />
      <InventoryTiles />
    </div>
  );
}
