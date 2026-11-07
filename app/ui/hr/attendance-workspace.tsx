'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getCurrentUser, hasWrite, isSuperAdmin } from '@/app/lib/api/users';
import AttendanceImportPanel from '@/app/ui/hr/attendance-import-panel';
import AttendanceTable from '@/app/ui/hr/attendance-table';
import ExceptionsModal from '@/app/ui/hr/exceptions-modal';
import HolidaysPanel from '@/app/ui/hr/holidays-panel';
import LateComingReport from '@/app/ui/hr/late-coming-report';
import ModificationsModal from '@/app/ui/hr/modifications-modal';
import RefusalsPanel from '@/app/ui/hr/refusals-panel';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

const TABS = [
  { id: 'daily', label: 'Daily register' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'late', label: 'Late coming' },
  // Super Admin only — filtered below (058, the client's decision of 2026-11-06). The log carries
  // where a named person physically was and how well their face matched; the server refuses
  // everyone else with SUPER_ADMIN_REQUIRED, so the tab is not offered to them.
  { id: 'refusals', label: 'Refusals' },
  { id: 'import', label: 'Bulk import' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * The attendance administration surface.
 *
 * Exceptions and modifications are dialogs rather than tabs on purpose: both are
 * things you consult *while* working the daily register, and making them tabs
 * would mean losing the date and site you had selected to look at either one.
 */
export default function AttendanceWorkspace() {
  const [tab, setTab] = useState<TabId>('daily');
  const [showExceptions, setShowExceptions] = useState(false);
  const [showModifications, setShowModifications] = useState(false);

  // Resolves from the same ['currentUser'] cache entry the sidebar already populated.
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const tabs = TABS.filter(
    (entry) => entry.id !== 'refusals' || isSuperAdmin(user),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabStrip
          tabs={tabs}
          active={tab}
          onChange={setTab}
          idPrefix="attendance"
        />
        <div className="flex gap-2">
          <SecondaryButton type="button" onClick={() => setShowExceptions(true)}>
            Exceptions
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setShowModifications(true)}>
            Modifications
          </SecondaryButton>
        </div>
      </div>

      <TabPanel id="daily" idPrefix="attendance" active={tab}>
        <AttendanceTable />
      </TabPanel>
      <TabPanel id="holidays" idPrefix="attendance" active={tab}>
        <HolidaysPanel />
      </TabPanel>
      <TabPanel id="late" idPrefix="attendance" active={tab}>
        <LateComingReport />
      </TabPanel>
      {hasWrite(user, 'ATTENDANCE') && (
        <TabPanel id="refusals" idPrefix="attendance" active={tab}>
          <RefusalsPanel />
        </TabPanel>
      )}
      <TabPanel id="import" idPrefix="attendance" active={tab}>
        <AttendanceImportPanel />
      </TabPanel>

      {showExceptions && <ExceptionsModal onClose={() => setShowExceptions(false)} />}
      {showModifications && (
        <ModificationsModal onClose={() => setShowModifications(false)} />
      )}
    </div>
  );
}
