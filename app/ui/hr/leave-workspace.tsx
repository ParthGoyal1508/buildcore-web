'use client';

import { useState } from 'react';

import LeaveApplicationsTable from '@/app/ui/hr/leave-applications-table';
import LeaveBalanceTable from '@/app/ui/hr/leave-balance-table';
import LeavePolicyPanel from '@/app/ui/hr/leave-policy-panel';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';

const TABS = [
  { id: 'applications', label: 'Applications' },
  { id: 'balances', label: 'Balances' },
  // 2026-10-16: the policy leave is credited on, and the go-live import.
  { id: 'policy', label: 'Policy' },
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
      <TabPanel id="policy" idPrefix="leave" active={tab}>
        <LeavePolicyPanel />
      </TabPanel>
    </div>
  );
}
