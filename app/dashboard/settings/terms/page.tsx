import PageHeader from "@/app/ui/page-header";
import { TermsScreen } from "@/app/ui/settings/terms-screen";

export const metadata = { title: "Terms and conditions" };

/**
 * Company scope comes from the session (019 FR-004); the screen sends nothing.
 *
 * The description says what editing does, because the page title alone invites the
 * wrong assumption: that changing the standard set changes every document raised
 * under it. It does not — an award keeps the terms it was signed under.
 */
export default function TermsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Terms and conditions"
        description="The standard clauses a new work order, letter of intent or purchase order starts from."
      />
      <TermsScreen />
    </main>
  );
}
