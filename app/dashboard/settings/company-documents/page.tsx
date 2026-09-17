import { CompanyDocumentsScreen } from '@/app/ui/documents/company-documents-screen';
import PageHeader from '@/app/ui/page-header';
import { CompanyProvider } from '@/app/ui/settings/company-context';

export const metadata = { title: 'Company documents' };

/**
 * The company's statutory papers (017 US1).
 *
 * The gap this closes: the company record stored GSTIN, PAN, TAN, the PF establishment
 * code and the rest as *numbers*, with nowhere to attach the certificates behind them.
 * A number nobody can produce a certificate for is not evidence of anything.
 *
 * Wrapped in `CompanyProvider` (017 FR-021), per page rather than on `app/dashboard/settings/layout.tsx`: that layout wraps every
 * settings section, and `employee-setup` already mounts its own provider — hoisting would
 * render two company selectors on that page. Feature 019 replaces this with one
 * application-wide switcher and these wrappers come out then.
 */
export default function CompanyDocumentsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Company Documents"
        description="The certificates behind your registration numbers — and which are still missing."
      />
      <CompanyProvider>
        <CompanyDocumentsScreen />
      </CompanyProvider>
    </main>
  );
}
