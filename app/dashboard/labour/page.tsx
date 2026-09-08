'use client';

import {
  BanknotesIcon,
  CameraIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

/**
 * Capture is first because it is the daily action; everything below it is review or
 * masters. It is also the only tile that leaves the dashboard shell — the capture
 * screen lives at `/labour/muster`, outside `/dashboard`, because it is the
 * supervisor's phone flow (013 FR-001). It had no entry point at all until now:
 * `ROUTES.musterCapture` was defined and never linked, so the screen was reachable
 * only by typing its URL.
 *
 * No permission filtering, for the same reason the other six tiles have none:
 * capture needs `DAILY_WORKER_REGISTRY`, which `ModuleGuard` has already established
 * for anyone who can see this page at all.
 */
const TILES: Tile[] = [
  {
    name: 'Capture Muster',
    href: ROUTES.musterCapture,
    icon: CameraIcon,
    description:
      'Mark today’s workers present on site, with a photo and a GPS fix.',
  },
  {
    name: 'Wage Rates',
    href: ROUTES.labourWageRates,
    icon: BanknotesIcon,
    description: 'Per-project daily rates by skill category, effective-dated.',
  },
  {
    name: 'Workers',
    href: ROUTES.labourWorkers,
    icon: UserGroupIcon,
    description: 'The labour registry — direct and contractor-engaged.',
  },
  {
    name: 'Gangs',
    href: ROUTES.labourGangs,
    icon: UsersIcon,
    description: 'Group workers under a leader for faster muster capture.',
  },
  {
    name: 'Musters',
    href: ROUTES.labourMusters,
    icon: ClipboardDocumentCheckIcon,
    description: 'Review and approve submitted attendance.',
  },
  {
    name: 'Payment Sheets',
    href: ROUTES.labourPaymentSheets,
    icon: DocumentTextIcon,
    description: 'Generate, approve and disburse cash payment sheets.',
  },
  {
    name: 'Advances',
    href: ROUTES.labourAdvances,
    icon: CreditCardIcon,
    description: 'Advances against wages and their recovery.',
  },
];

export default function LabourIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Labour"
        description="Wage masters, the worker registry, supervisor attendance and cash payment sheets."
      />
      <TileGrid tiles={TILES} />
    </div>
  );
}
