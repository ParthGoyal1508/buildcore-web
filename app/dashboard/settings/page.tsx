'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BuildingOffice2Icon,
  IdentificationIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES, SETTINGS_PERMISSIONS, USER_ADMIN_ROLES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';

const SECTIONS = [
  {
    key: 'companies' as const,
    href: ROUTES.settingsCompanies,
    title: 'Companies',
    description: 'Registration, statutory and payroll settings per company.',
    icon: BuildingOffice2Icon,
  },
  {
    key: 'roles' as const,
    href: ROUTES.settingsRoles,
    title: 'Roles',
    description: 'Define roles and the permissions each one grants.',
    icon: IdentificationIcon,
  },
  {
    key: 'users' as const,
    href: ROUTES.settingsUsers,
    title: 'Users',
    description: 'Administer existing accounts — role, status, removal.',
    icon: UsersIcon,
  },
  {
    key: 'employee-setup' as const,
    href: ROUTES.settingsEmployeeSetup,
    title: 'Employee Setup',
    description: 'Departments, designations, document types, shifts, code series.',
    icon: WrenchScrewdriverIcon,
  },
];

/** Lists only the sections the signed-in user can actually open, so nobody is
 * invited into a page that will just refuse them. */
export default function SettingsPage() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const visible = SECTIONS.filter((section) => {
    if (!user) return false;
    if (!user.permissions.includes(SETTINGS_PERMISSIONS[section.key])) return false;
    if (section.key === 'users') {
      return user.roleNames.some((name) =>
        (USER_ADMIN_ROLES as readonly string[]).includes(name),
      );
    }
    return true;
  });

  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Settings</h1>
      {user && visible.length === 0 && (
        <p className="text-sm text-gray-600">
          Your role doesn&apos;t include access to any Settings section.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.key}
              href={section.href}
              className="flex gap-3 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <Icon className="w-6 shrink-0 text-gray-500" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-medium text-gray-900">{section.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
