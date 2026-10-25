'use client';

import { urlEnum, useUrlState } from '@/app/lib/use-url-state';
import ReimbursementRegister from '@/app/ui/hr/reimbursement-register';
import ReimbursementsAdminTable from '@/app/ui/hr/reimbursements-admin-table';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';

const TABS = [
  { id: 'claims', label: 'Claims' },
  { id: 'register', label: 'Register' },
] as const;

/**
 * Reimbursement administration (042): the review queue, and beside it the Register — every
 * non-draft claim with status subtotals, the accounting view the queue cannot give.
 *
 * The view rides in the URL (`view=register`) so a filtered register can be sent as a link,
 * while each tab's own filters stay its own: the queue's live in the URL already
 * (`reimbursements-admin-table.tsx`), the register's are per-visit.
 */
export default function ReimbursementsWorkspace() {
  const [{ view }, setView] = useUrlState({
    view: urlEnum(
      TABS.map((tab) => tab.id),
      'claims',
    ),
  });

  return (
    <div className="flex flex-col gap-4">
      <TabStrip
        tabs={TABS}
        active={view}
        onChange={(id) => setView({ view: id })}
        idPrefix="reimbursements"
      />
      <TabPanel id="claims" idPrefix="reimbursements" active={view}>
        <ReimbursementsAdminTable />
      </TabPanel>
      <TabPanel id="register" idPrefix="reimbursements" active={view}>
        <ReimbursementRegister />
      </TabPanel>
    </div>
  );
}
