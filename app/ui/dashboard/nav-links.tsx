import Link from 'next/link';
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  TruckIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { ROUTES } from '@/app/lib/constants';

// Mirrors the module list in docs/prd/00-master-prd.md §4 Scope & §7 Module
// Specifications — one entry per ERP module.
const links = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'HR & Payroll', href: '/dashboard/hr', icon: UsersIcon },
  { name: 'Projects', href: '/dashboard/projects', icon: BriefcaseIcon },
  { name: 'Plant & Machinery', href: '/dashboard/plant', icon: TruckIcon },
  { name: 'Inventory', href: '/dashboard/inventory', icon: ArchiveBoxIcon },
  { name: 'Partners', href: '/dashboard/partners', icon: UserGroupIcon },
  { name: 'Reports', href: '/dashboard/reports', icon: ChartBarIcon },
  // Leaves this shell entirely, for a user who is both an admin and an employee
  // (research.md §2, spec FR-017). The `/my` tree has its own bottom-tab layout.
  { name: 'My Workspace', href: ROUTES.myPunch, icon: ClockIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
];

export default function NavLinks() {
  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className="flex h-[48px] items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <LinkIcon className="w-6" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
