'use client';

import {
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

const TILES: Tile[] = [
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
