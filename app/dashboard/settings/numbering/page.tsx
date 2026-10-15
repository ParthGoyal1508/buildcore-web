import PageHeader from '@/app/ui/page-header';
import { NumberingScreen } from '@/app/ui/settings/numbering-screen';

export const metadata = { title: 'Numbering' };

export default function NumberingPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Numbering"
        description="How this company numbers its projects, vendors, work orders, NOCs, job cards, issue slips, challans, transfer slips, machines and assets. Codes are given automatically when a record is created; changing a format affects new records only."
      />
      <NumberingScreen />
    </main>
  );
}
