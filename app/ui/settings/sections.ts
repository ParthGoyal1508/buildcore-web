import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  HashtagIcon,
  IdentificationIcon,
  PencilSquareIcon,
  UserCircleIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import {
  ROUTES,
  SETTINGS_PERMISSIONS,
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
    key: 'letter-templates',
    href: ROUTES.settingsLetterTemplates,
    title: 'Letter Templates',
    description:
      'The wording of every letter the company issues — HR, recruitment, project and payment — grouped by where it is issued.',
    icon: DocumentTextIcon,
  },
  {
    key: 'numbering',
    href: ROUTES.settingsNumbering,
    title: 'Numbering',
    description:
      'How project codes, vendor codes, work order numbers, machines and assets are numbered.',
    icon: HashtagIcon,
  },
  {
    key: 'billing-rates',
    href: ROUTES.settingsBillingRates,
    title: 'Billing Rates',
    description:
      'CGST, SGST, IGST and TDS. They start at today’s statute; a bill already issued keeps the rates it was issued at.',
    icon: BanknotesIcon,
  },
  {
    key: 'terms',
    href: ROUTES.settingsTerms,
    title: 'Terms and conditions',
    description:
      'The standard clauses a new work order, LOI or purchase order starts from.',
    icon: ClipboardDocumentCheckIcon,
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
    description:
      'Departments, designations, document types, shifts, code series.',
    icon: WrenchScrewdriverIcon,
  },
  {
    // 2026-10-14. Listed only for a Super Admin — `visibleSettingsSections` filters on
    // `SETTINGS_PERMISSIONS['personal-settings']`, which is `CROSS_COMPANY_ACCESS` — so nobody
    // else learns the setting exists. Even a Super Admin sees only a password prompt inside.
    // Named for what it is rather than its one setting since 2026-10-15 — the client: "we do not
    // want to show 'Cash Visibility', instead rename it to 'Personal Settings'". Last in the list,
    // and neither its description nor its icon says what is behind the password.
    key: 'personal-settings',
    href: ROUTES.settingsPersonal,
    title: 'Personal Settings',
    description:
      'Sensitive settings. Super Admin only — your password reveals them.',
    icon: UserCircleIcon,
  },
];

/**
 * The sections this user may actually open.
 *
 * Gated on the permission alone since 036 C4. The `users` section used to also require one of two
 * role *names* ("Super Admin", "HO User"), which the backend dropped on 2026-08-31
 * (`UsersAdminService`, "roles are data an administrator edits"): a custom administrator role
 * granted `USER_MANAGEMENT` passed the API and was still refused here.
 */
export function visibleSettingsSections(
  user: { permissions: readonly string[] } | undefined,
): typeof SETTINGS_SECTIONS {
  if (!user) return [];
  return SETTINGS_SECTIONS.filter((section) =>
    user.permissions.includes(SETTINGS_PERMISSIONS[section.key]),
  );
}

/** Shared with `app/dashboard/settings/layout.tsx`. The permission, as the API checks it (036 C4). */
export function maySettingsAdministerUsers(user: {
  permissions: readonly string[];
}): boolean {
  return user.permissions.includes(SETTINGS_PERMISSIONS.users);
}
