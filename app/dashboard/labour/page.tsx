'use client';

import {
  BanknotesIcon,
  CameraIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  TableCellsIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { useCashPolicy } from '@/app/lib/cash-entry';
import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

/**
 * Attendance is first because it is the daily action; it is also the only tile that leaves the
 * dashboard shell — face punch in/out lives at `/labour/attendance`, outside `/dashboard`, because
 * it is the supervisor's phone flow (013 FR-001, 031). Site Rates and Supervisors are the HR
 * office's, so they show only with Labour Approve. Advances, paid in cash at site, go while the
 * company hides cash (038).
 */
const tilesFor = (canManage: boolean, cashHidden: boolean): Tile[] => [
  {
    name: 'Attendance',
    href: ROUTES.labourAttendance,
    icon: CameraIcon,
    description: 'Punch labour in and out with a face photo, and register new labour.',
  },
  {
    name: 'Labour',
    href: ROUTES.labourWorkers,
    icon: UserGroupIcon,
    description: 'Everyone registered, with their codes and face photos.',
  },
  ...(canManage
    ? [
        {
          name: 'Site Rates',
          href: ROUTES.labourSiteRates,
          icon: BanknotesIcon,
          description: 'Daily wage for male and female labour at each site.',
        },
        {
          name: 'Supervisors',
          href: ROUTES.labourSupervisors,
          icon: UsersIcon,
          description: 'Which sites each supervisor marks attendance at.',
        },
      ]
    : []),
  {
    name: 'Muster Attendance',
    href: ROUTES.labourMusterAttendance,
    icon: TableCellsIcon,
    description:
      'Punch in and out times, hours, missing punches and corrections — by day or month, with the Excel.',
  },
  {
    name: 'Payment Sheets',
    href: ROUTES.labourPaymentSheets,
    icon: DocumentTextIcon,
    description: 'Generate a site’s payment sheet for any dates, then approve and pay.',
  },
  {
    name: 'Musters',
    href: ROUTES.labourMusters,
    icon: ClipboardDocumentCheckIcon,
    description: 'Each site’s daily attendance, built from the face punches.',
  },
  ...(cashHidden
    ? []
    : [
        {
          name: 'Advances',
          href: ROUTES.labourAdvances,
          icon: CreditCardIcon,
          description: 'Advances against wages and their recovery.',
        },
      ]),
];

export default function LabourIndexPage() {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const canManage = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;
  const { hidden: cashHidden } = useCashPolicy();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Labour"
        description="Face attendance on site, site rates, and labour payment sheets."
      />
      <TileGrid tiles={tilesFor(canManage, cashHidden)} />
    </div>
  );
}
