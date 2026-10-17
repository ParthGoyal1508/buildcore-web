import type { Metadata } from 'next';

import BankPaymentSheet from '@/app/ui/hr/bank-payment-sheet';
import PayrollRunsTable from '@/app/ui/hr/payroll-runs-table';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Payroll' };

export default function PayrollPage() {
  return (
    <main>
      <PageHeader title="Payroll" className="mb-6" />
      <BankPaymentSheet />
      <PayrollRunsTable />
    </main>
  );
}
