'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getCurrentUser } from '@/app/lib/api/users';
import { PLANT_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';

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
    permission: PLANT_PERMISSIONS.equipment,
    description:
      'Every machine, where it is deployed, how hard it is working, and whose paperwork is about to lapse.',
  },
  {
    name: 'Logbook',
    href: ROUTES.plantLogbook,
    permission: PLANT_PERMISSIONS.logbook,
    description:
      'A day per machine: opening and closing readings, hours run, fuel burned and who operated it.',
  },
  {
    name: 'Fuel',
    href: ROUTES.plantFuel,
    permission: PLANT_PERMISSIONS.fuel,
    description:
      'Fuel drawn, and where consumption ran past what the machine’s category expects.',
  },
  {
    name: 'Maintenance',
    href: ROUTES.plantMaintenance,
    permission: PLANT_PERMISSIONS.maintenance,
    description:
      'Breakdowns and scheduled work, the parts each job consumed, and what it cost.',
  },
  {
    name: 'Service Schedules',
    href: ROUTES.plantServices,
    permission: PLANT_PERMISSIONS.services,
    description:
      'What each machine is due for next, measured against the reading it is on now.',
  },
  {
    name: 'Spare Parts',
    href: ROUTES.plantSpareParts,
    permission: PLANT_PERMISSIONS.spareParts,
    description:
      'Workshop stock, its weighted average rate, and what has fallen below its reorder level.',
  },
  {
    name: 'Hire Bills',
    href: ROUTES.plantHireBills,
    permission: PLANT_PERMISSIONS.hireBills,
    description:
      'Rental invoices for hired machines, checked against the logbook before they are paid.',
  },
  {
    name: 'Masters',
    href: ROUTES.plantMasters,
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
      <h1 className={`${lusitana.className} text-2xl`}>Plant &amp; Machinery</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <h2 className="text-sm font-semibold text-gray-900">
              {section.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
