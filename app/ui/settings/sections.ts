import {
  BuildingOffice2Icon,
  IdentificationIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import {
  ROUTES,
  SETTINGS_PERMISSIONS,
  USER_ADMIN_ROLES,
} from '@/app/lib/constants';

/**
 * The sections of Settings, in the order both the index tiles and the in-module tab
 * strip present them. One definition, two presentations — see `app/ui/hr/sections.ts`
 * for the same arrangement and why.
 */
export const SETTINGS_SECTIONS: {
  key: keyof typeof SETTINGS_PERMISSIONS;
  href: string;
  title: string;
  description: string;
  icon: typeof UsersIcon;
}[] = [
  {
    key: 'companies',
    href: ROUTES.settingsCompanies,
    title: 'Companies',
    description: 'Registration, statutory and payroll settings per company.',
    icon: BuildingOffice2Icon,
  },
  {
    key: 'roles',
    href: ROUTES.settingsRoles,
    title: 'Roles',
    description: 'Define roles and the permissions each one grants.',
    icon: IdentificationIcon,
  },
  {
    key: 'users',
    href: ROUTES.settingsUsers,
    title: 'Users',
    description: 'Administer existing accounts — role, status, removal.',
    icon: UsersIcon,
  },
  {
    key: 'employee-setup',
    href: ROUTES.settingsEmployeeSetup,
    title: 'Employee Setup',
    description: 'Departments, designations, document types, shifts, code series.',
    icon: WrenchScrewdriverIcon,
  },
];

/**
 * The sections this user may actually open.
 *
 * The `users` rule — a permission *and* one of two role names (FR-010, mirroring
 * `UsersAdminService.assertMayAdminister()`) — is the reason this is a function
 * rather than a filter written at each call site: it was already stated in the index
 * and the layout guard, and the tab strip would have been a third copy.
 */
export function visibleSettingsSections(
  user: { permissions: readonly string[]; roleNames: readonly string[] } | undefined,
): typeof SETTINGS_SECTIONS {
  if (!user) return [];
  return SETTINGS_SECTIONS.filter((section) => {
    if (!user.permissions.includes(SETTINGS_PERMISSIONS[section.key])) return false;
    if (section.key === 'users') return maySettingsAdministerUsers(user);
    return true;
  });
}

/** Shared with `app/dashboard/settings/layout.tsx`, which refuses the section. */
export function maySettingsAdministerUsers(user: {
  roleNames: readonly string[];
}): boolean {
  return user.roleNames.some((name) =>
    (USER_ADMIN_ROLES as readonly string[]).includes(name),
  );
}
