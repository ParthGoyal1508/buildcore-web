'use client';

import { useState } from 'react';

import { lusitana } from '@/app/ui/fonts';
import IssueModal from '@/app/ui/inventory/issue-modal';
import MastersModal from '@/app/ui/inventory/masters-modal';
import PurchaseModal from '@/app/ui/inventory/purchase-modal';
import StockTable from '@/app/ui/inventory/stock-table';
import TransferModal from '@/app/ui/inventory/transfer-modal';

type OpenModal = 'purchase' | 'issue' | 'transfer' | 'masters' | null;

/**
 * The stock screen, and the host for the three movement dialogs and the masters.
 *
 * A client component rather than a server one because every modal it opens mutates
 * stock, and the table has to reflect that without a navigation. Each dialog
 * invalidates the whole `['inventory']` key on success, so the numbers behind it are
 * never the ones from before the write.
 */
export default function StockPage() {
  const [open, setOpen] = useState<OpenModal>(null);
  const close = () => setOpen(null);

  return (
    <div className="flex flex-col gap-6">
      <h1 className={`${lusitana.className} text-2xl`}>Stock</h1>

      <StockTable
        onNewPurchase={() => setOpen('purchase')}
        onNewIssue={() => setOpen('issue')}
        onNewTransfer={() => setOpen('transfer')}
        onOpenMasters={() => setOpen('masters')}
      />

      {open === 'purchase' && <PurchaseModal onClose={close} />}
      {open === 'issue' && <IssueModal onClose={close} />}
      {open === 'transfer' && <TransferModal onClose={close} />}
      {open === 'masters' && <MastersModal onClose={close} />}
    </div>
  );
}
