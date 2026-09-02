'use client';

import { useState } from 'react';

import LeaveApplicationsTable from '@/app/ui/hr/leave-applications-table';
import LeaveBalanceTable from '@/app/ui/hr/leave-balance-table';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';

const TABS = [
  { id: 'applications', label: 'Applications' },
  { id: 'balances', label: 'Balances' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function LeaveWorkspace() {
  const [tab, setTab] = useState<TabId>('applications');
  return (
    <div className="flex flex-col gap-2">
      <TabStrip tabs={TABS} active={tab} onChange={setTab} idPrefix="leave" />
      <TabPanel id="applications" idPrefix="leave" active={tab}>
        <LeaveApplicationsTable />
      </TabPanel>
      <TabPanel id="balances" idPrefix="leave" active={tab}>
        <LeaveBalanceTable />
      </TabPanel>
    </div>
  );
}
