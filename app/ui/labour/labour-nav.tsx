'use client';

import {
  BanknotesIcon,
  CameraIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  TableCellsIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Labour. Every operational tab needs `DAILY_WORKER_REGISTRY`, which
 * `ModuleGuard` has already established for the whole subtree; Reports additionally needs
 * `REPORTS`, and Site Rates and Supervisors are the HR office's (`LABOUR_APPROVE`), filtered here so
 * nobody sees a tab they cannot use (spec FR-002).
 *
 * Attendance is first because it is the daily action, and it is the one tab whose route is outside
 * `/dashboard`: face punch in/out is a field surface on the supervisor's phone (031). The old
 * project × skill Wage Rates and the Gangs tabs left the strip with the muster wizard they served
 * (pay comes from site rates and nobody is marked by gang now); their pages stay reachable for
 * history.
 */
export default function LabourNav({
  canSeeReports,
  canManage,
  className,
  stripHidden = false,
}: {
  canSeeReports: boolean;
  canManage: boolean;
  className?: string;
  stripHidden?: boolean;
}) {
  const tabs = [
    {
      name: 'Attendance',
      href: ROUTES.labourAttendance,
      match: '/labour',
      icon: CameraIcon,
    },
    { name: 'Labour', href: ROUTES.labourWorkers, icon: UserGroupIcon },
    ...(canManage
      ? [
          { name: 'Site Rates', href: ROUTES.labourSiteRates, icon: BanknotesIcon },
          { name: 'Supervisors', href: ROUTES.labourSupervisors, icon: UsersIcon },
        ]
      : []),
    {
      name: 'Attendance Sheet',
      href: ROUTES.labourAttendanceSheet,
      icon: TableCellsIcon,
    },
    {
      name: 'Payment Sheets',
      href: ROUTES.labourPaymentSheets,
      icon: DocumentTextIcon,
    },
    {
      name: 'Musters',
      href: ROUTES.labourMusters,
      icon: ClipboardDocumentCheckIcon,
    },
    { name: 'Advances', href: ROUTES.labourAdvances, icon: CreditCardIcon },
    ...(canSeeReports
      ? [
          {
            name: 'Reports',
            href: ROUTES.labourReportsDeployment,
            match: '/dashboard/labour/reports',
            icon: ChartBarIcon,
          },
        ]
      : []),
  ];
  return (
    <SectionTabs
      label="Labour sections"
      tabs={tabs}
      className={className}
      mobile
      stripHidden={stripHidden}
    />
  );
}
