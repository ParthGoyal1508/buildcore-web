'use client';

import { useParams } from 'next/navigation';

import BillPackageDetail from '@/app/ui/projects/bill-package-detail';
import FinancialsGuard from '@/app/ui/projects/financials-guard';

/** One bill package: its lines, abstract, register and check list (024 Story 3 to 5). */
export default function BillPackagePage() {
  const params = useParams<{ packageId: string }>();

  return (
    <FinancialsGuard>
      <BillPackageDetail packageId={params.packageId} />
    </FinancialsGuard>
  );
}
