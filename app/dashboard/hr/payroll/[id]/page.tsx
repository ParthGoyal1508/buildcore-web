import type { Metadata } from 'next';

import PayrollRunDetail from '@/app/ui/hr/payroll-run-detail';

export const metadata: Metadata = { title: 'Payroll run' };

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PayrollRunDetail runId={id} />;
}
