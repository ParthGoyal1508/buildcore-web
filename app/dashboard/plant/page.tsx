'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BanknotesIcon,
  BookOpenIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  FireIcon,
  Squares2X2Icon,
  TruckIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';

import { getCurrentUser } from '@/app/lib/api/users';
import { PLANT_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid from '@/app/ui/tile-grid';

/**
 * The Plant & Machinery module index.
 *
 * Tiles rather than a redirect to the first section, matching Partners and
 * Inventory. Filtered by permission for the same reason the tab strip is: this
 * module's sections carry five different permissions, and a tile that refuses on
 * arrival is worse than no tile.
 */
const SECTIONS = [
  {
    name: 'Asset Register',
    href: ROUTES.plantEquipment,
    icon: TruckIcon,
    permission: PLANT_PERMISSIONS.equipment,
    description:
      'Every machine, where it is deployed, how hard it is working, and whose paperwork is about to lapse.',
  },
  {
    name: 'Logbook',
    href: ROUTES.plantLogbook,
    icon: BookOpenIcon,
    permission: PLANT_PERMISSIONS.logbook,
    description:
      'A day per machine: opening and closing readings, hours run, fuel burned and who operated it.',
  },
  {
    name: 'Fuel',
    href: ROUTES.plantFuel,
    icon: FireIcon,
    permission: PLANT_PERMISSIONS.fuel,
    description:
      'Fuel drawn, and where consumption ran past what the machine’s category expects.',
  },
  {
    name: 'Maintenance',
    href: ROUTES.plantMaintenance,
    icon: WrenchIcon,
    permission: PLANT_PERMISSIONS.maintenance,
    description:
      'Breakdowns and scheduled work, the parts each job consumed, and what it cost.',
  },
  {
    name: 'Service Schedules',
    href: ROUTES.plantServices,
    icon: ClipboardDocumentCheckIcon,
    permission: PLANT_PERMISSIONS.services,
    description:
      'What each machine is due for next, measured against the reading it is on now.',
  },
  {
    name: 'Spare Parts',
    href: ROUTES.plantSpareParts,
    icon: Cog6ToothIcon,
    permission: PLANT_PERMISSIONS.spareParts,
    description:
      'Workshop stock, its weighted average rate, and what has fallen below its reorder level.',
  },
  {
    name: 'Hire Bills',
    href: ROUTES.plantHireBills,
    icon: BanknotesIcon,
    permission: PLANT_PERMISSIONS.hireBills,
    description:
      'Rental invoices for hired machines, checked against the logbook before they are paid.',
  },
  {
    name: 'Masters',
    href: ROUTES.plantMasters,
    icon: Squares2X2Icon,
    permission: PLANT_PERMISSIONS.masters,
    description:
      'Equipment categories, document types, and the effective-dated hire rate history.',
  },
];

export default function PlantPage() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const permissions = user?.permissions ?? [];
  const visible = SECTIONS.filter((section) =>
    permissions.includes(section.permission as never),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plant & Machinery"
        description="Machines, their running record, and what they cost to keep working."
      />
      <TileGrid tiles={visible} />
    </div>
  );
}
