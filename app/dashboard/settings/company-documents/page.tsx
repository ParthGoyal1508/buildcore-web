import { CompanyDocumentsScreen } from '@/app/ui/documents/company-documents-screen';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Company documents' };

/**
 * The company's statutory papers (017 US1).
 *
 * The gap this closes: the company record stored GSTIN, PAN, TAN, the PF establishment
 * code and the rest as *numbers*, with nowhere to attach the certificates behind them.
 * A number nobody can produce a certificate for is not evidence of anything.
 */
export default function CompanyDocumentsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Company Documents"
        description="The certificates behind your registration numbers — and which are still missing."
      />
      <CompanyDocumentsScreen />
    </main>
  );
}
