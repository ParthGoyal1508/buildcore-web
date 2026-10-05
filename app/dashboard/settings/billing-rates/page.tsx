import PageHeader from '@/app/ui/page-header';
import { BillingRatesScreen } from '@/app/ui/settings/billing-rates-screen';

export const metadata = { title: 'Billing rates' };

export default function BillingRatesPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Billing Rates"
        description="The statutory rates a running-account bill is computed at. They start at today's statute; changing one affects bills composed afterwards, never one already issued."
      />
      <BillingRatesScreen />
    </main>
  );
}
