import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  IdentificationIcon,
  PencilSquareIcon,
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
    key: 'approvals',
    href: ROUTES.settingsApprovals,
    title: 'Approvals',
    description:
      'Which role decides at each level of an approval chain. Nothing can be approved until these are set.',
    icon: CheckCircleIcon,
  },
  {
    key: 'company-documents',
    href: ROUTES.settingsCompanyDocuments,
    title: 'Company Documents',
    description:
      'GST, PF, ESIC and the rest — the certificates behind the registration numbers, and which are missing.',
    icon: DocumentTextIcon,
  },
  {
    key: 'project-documents',
    href: ROUTES.settingsProjectDocuments,
    title: 'Project Documents',
    description:
      'Which documents every project must hold before it counts as fully papered.',
    icon: ClipboardDocumentCheckIcon,
  },
  {
    key: 'letter-kinds',
    href: ROUTES.settingsLetterKinds,
    title: 'Letter Kinds',
    description:
      'The kinds of letter this company issues. New kinds are added here, not in a release.',
    icon: PencilSquareIcon,
  },
  {
    key: 'signatories',
    href: ROUTES.settingsSignatories,
    title: 'Signatories',
    description:
      'Who signs letters, and the signature applied to them. Replacing a signature leaves issued letters untouched.',
    icon: IdentificationIcon,
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
