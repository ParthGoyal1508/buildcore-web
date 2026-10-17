'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import {
  Role,
  createRole,
  updateRole,
  type RoleGrant,
} from '@/app/lib/api/settings';
import {
  MESSAGES,
  NAV_GOVERNING_PERMISSIONS,
  NAV_MODULES,
  NAV_MODULE_BY_PERMISSION,
  PERMISSIONS,
  ROLE_LEVELS,
  permissionLabel,
} from '@/app/lib/constants';
import { getCurrentUser } from '@/app/lib/api/users';
import { Button } from '@/app/ui/button';
import { mayGrant } from '@/app/ui/settings/grant-ceiling';
import { toast } from '@/app/ui/toast';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Add/Edit role.
 *
 * Permissions come from the fixed `PERMISSIONS` constant as real checkboxes — never
 * a free-text field (spec FR-007). The PRD's own mock had a comma-separated text
 * input here; that would let an admin type a value the API rejects, so it is
 * deliberately not reproduced.
 *
 * The list is split in two (014 FR-013). Some permissions decide what appears in the
 * sidebar; the rest gate content *within* a module and change nothing about the menu.
 * Both halves are derived, so a module added to `NAV_MODULES` — 012's Assets was the
 * most recent — moves its permission across on its own. Presented as one undifferentiated list, an admin clears one of
 * those nine, expects a module to disappear, and is silently misled — this screen is
 * where they configure navigation, so it has to say which checkbox does that.
 */
// Partitioned once at module scope, not per render. Both halves are derived from
// `PERMISSIONS` and `NAV_GOVERNING_PERMISSIONS`, so a permission added to the enum or a
// module added to `NAV_MODULES` lands in the right group with no edit here.
const NAV_PERMISSIONS = PERMISSIONS.filter((permission) =>
  NAV_GOVERNING_PERMISSIONS.has(permission),
);
const NON_NAV_PERMISSIONS = PERMISSIONS.filter(
  (permission) => !NAV_GOVERNING_PERMISSIONS.has(permission),
);


/**
 * Which areas a role may already change (FR-019).
 *
 * An area absent from `grants` entirely is **writable**, not read-only: that is what the backend
 * does with a role that named no levels, and every role predating the split is in that state.
 * Guessing read-only here would narrow every existing role the first time somebody opened it to
 * change its name.
 */
function initialWritable(role: Role | null): string[] {
  if (!role) return [];
  const named = new Set(role.grants.map((grant) => grant.permission));
  return role.permissions.filter(
    (permission) =>
      !named.has(permission) ||
      role.grants.some(
        (grant) => grant.permission === permission && grant.level === 'write',
      ),
  );
}

/**
 * The grants a save should send (FR-018, FR-020).
 *
 * Always sent, never omitted: omitting means read **and** write on everything, so a role narrowed
 * on this screen would silently widen again. Write always carries read with it, which is why this
 * emits two rows rather than one — "may edit but may not see" is not a state any screen here can
 * render, and the backend refuses it outright.
 */
function grantsFor(selected: string[], writable: Set<string>): RoleGrant[] {
  return selected.flatMap((permission) =>
    writable.has(permission)
      ? [
          { permission, level: 'read' as const },
          { permission, level: 'write' as const },
        ]
      : [{ permission, level: 'read' as const }],
  );
}

/**
 * One area's checkbox and, when ticked, its level.
 *
 * The level appears only for a ticked area. An area nobody has granted has no level to choose, and
 * rendering a disabled pair of radios against every unticked row turns a nine-item list into
 * twenty-seven controls somebody has to read past.
 */
function PermissionRow({
  permission,
  description,
  checked,
  writable,
  onToggle,
  onLevel,
  canGrantRead = true,
  canGrantWrite = true,
}: {
  permission: string;
  description?: string;
  checked: boolean;
  writable: boolean;
  onToggle: () => void;
  onLevel: (level: 'read' | 'write') => void;
  /** 036 C10: whether the caller may grant this area at all, and at write — mirroring the API. */
  canGrantRead?: boolean;
  canGrantWrite?: boolean;
}) {
  const beyond = !canGrantRead
    ? 'Your own role does not include this, so you cannot grant it.'
    : undefined;
  return (
    <div>
      <CheckboxField
        id={`permission-${permission}`}
        label={permissionLabel(permission)}
        description={beyond ?? description}
        checked={checked}
        // Unticking is always allowed: taking a grant away hands nothing over.
        disabled={!canGrantRead && !checked}
        onChange={onToggle}
      />
      {checked && (
        <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ['read', ROLE_LEVELS.viewOnly, ROLE_LEVELS.viewOnlyHint],
              ['write', ROLE_LEVELS.viewAndChange, ROLE_LEVELS.viewAndChangeHint],
            ] as const
          ).map(([level, label, hint]) => (
            <label
              key={level}
              className="flex items-center gap-1.5 text-xs text-gray-600"
              title={hint}
            >
              <input
                type="radio"
                name={`level-${permission}`}
                value={level}
                checked={level === 'write' ? writable : !writable}
                disabled={level === 'write' && !canGrantWrite && !writable}
                onChange={() => onLevel(level)}
                className="h-3.5 w-3.5 border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Says when the chosen home is one this role cannot open (029 FR-021). Not refused: a holder with
 * a second role may well open it — but someone with only this one lands on their first module
 * instead, and the editor should know that before saving rather than hear it from a user.
 */
function homeHint(homeModule: string, selected: string[]): string | undefined {
  const chosen = NAV_MODULES.find((navModule) => navModule.id === homeModule);
  if (!chosen) return 'Where holders of this role land when they sign in or open the app.';
  const required: readonly string[] = chosen.permissions;
  const opens =
    required.length === 0 || required.some((permission) => selected.includes(permission));
  return opens
    ? 'Where holders of this role land when they sign in or open the app.'
    : `This role does not include ${chosen.name}, so anyone holding only this role will land on their first module instead.`;
}

export default function RoleModal({
  role,
  onClose,
}: {
  role: Role | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  /**
   * Whether each ticked area may be changed as well as viewed (019 FR-018, FR-019).
   *
   * Seeded from the role's own grants, which is the whole point of FR-019: a screen that cannot
   * show an existing read-only grant silently widens it to write the next time anybody saves that
   * role, and nobody would see it happen.
   *
   * **An area absent from `grants` is writable**, not read-only. That is the backend's rule for a
   * role that named no levels — every role predating the split is in exactly that state — and
   * guessing read-only here would narrow every existing role the first time somebody opened it to
   * rename it.
   */
  const [writable, setWritable] = useState<Set<string>>(
    () => new Set(initialWritable(role)),
  );
  /** Where holders land after signing in (029 FR-020); '' is "their first module". */
  const [homeModule, setHomeModule] = useState(role?.homeModule ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // 036 C10: the caller's own grants, so areas beyond them are shown as not grantable up front
  // instead of refused (GRANT_EXCEEDS_CALLER) after Save.
  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const canRead = (permission: string) => mayGrant(me, permission, 'read');
  const canWrite = (permission: string) => mayGrant(me, permission, 'write');

  const initialSelected = role?.permissions ?? [];
  const initialWrite = initialWritable(role);
  const isDirty =
    name !== (role?.name ?? '') ||
    homeModule !== (role?.homeModule ?? '') ||
    selected.length !== initialSelected.length ||
    selected.some((p) => !initialSelected.includes(p)) ||
    writable.size !== initialWrite.length ||
    initialWrite.some((p) => !writable.has(p));

  const mutation = useMutation({
    mutationFn: () =>
      role
        ? updateRole(role.id, {
            name: name.trim(),
            permissions: selected,
            grants: grantsFor(selected, writable),
            homeModule: homeModule || null,
          })
        : createRole({
            name: name.trim(),
            permissions: selected,
            grants: grantsFor(selected, writable),
            homeModule: homeModule || null,
          }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(role ? `${saved.name} saved.` : `${saved.name} added.`);
      onClose();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        setNameError(error.message);
        return;
      }
      setServerError(errorMessage(error, MESSAGES.saveFailed));
    },
  });

  function toggle(permission: string) {
    const removing = selected.includes(permission);
    setSelected((current) =>
      removing
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
    // T074. Unticking an area clears its level rather than leaving an orphan the next save would
    // re-send. Ticking one grants view and change, which is what every role held before levels
    // existed — the narrower choice should be deliberate, not the default somebody trips into.
    setWritable((current) => {
      const next = new Set(current);
      if (removing) next.delete(permission);
      // Added at write only when the caller may grant write (036 C10); otherwise view only.
      else if (canWrite(permission)) next.add(permission);
      return next;
    });
  }

  /** FR-020 is structural here: there is no control that can express write-without-read. */
  function setLevel(permission: string, level: 'read' | 'write') {
    setWritable((current) => {
      const next = new Set(current);
      if (level === 'write') next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setServerError(null);
    if (!name.trim()) {
      setNameError('Role name is required');
      return;
    }
    if (selected.length === 0) {
      setServerError('Select at least one permission.');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      title={role ? `Edit ${role.name}` : 'Add role'}
      onClose={onClose}
      isDirty={isDirty}
      pending={mutation.isPending}
      footer={
        <>
          <SecondaryButton
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </SecondaryButton>
          <Button type="submit" form="role-form" loading={mutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={onSubmit} className="space-y-4">
        <FormError message={serverError} />
        <TextField
          id="role-name"
          label="Role name"
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />

        <SelectField
          id="role-home"
          label="Home page after sign-in"
          value={homeModule}
          hint={homeHint(homeModule, selected)}
          onChange={(event) => setHomeModule(event.target.value)}
        >
          <option value="">First module they can open</option>
          {NAV_MODULES.map((navModule) => (
            <option key={navModule.id} value={navModule.id}>
              {navModule.name}
            </option>
          ))}
        </SelectField>

        {/* 019 FR-021. Said once, above both groups: the choice is per area and it is about
            changing records, not about a permission model. */}
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {ROLE_LEVELS.hint} {ROLE_LEVELS.writeImpliesRead}
        </p>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">
            Sidebar modules
          </legend>
          <p className="mb-2 mt-1 text-xs text-gray-500">
            {MESSAGES.navPermissionsHint}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {NAV_PERMISSIONS.map((permission) => {
              const moduleName = NAV_MODULE_BY_PERMISSION.get(permission);
              return (
                <PermissionRow
                  key={permission}
                  permission={permission}
                  description={
                    moduleName
                      ? MESSAGES.permissionControlsModule(moduleName)
                      : undefined
                  }
                  checked={selected.includes(permission)}
                  writable={writable.has(permission)}
                  onToggle={() => toggle(permission)}
                  onLevel={(level) => setLevel(permission, level)}
                  canGrantRead={canRead(permission)}
                  canGrantWrite={canWrite(permission)}
                />
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">
            Within a module
          </legend>
          <p className="mb-2 mt-1 text-xs text-gray-500">
            {MESSAGES.nonNavPermissionsHint}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {NON_NAV_PERMISSIONS.map((permission) => (
              <PermissionRow
                key={permission}
                permission={permission}
                checked={selected.includes(permission)}
                writable={writable.has(permission)}
                onToggle={() => toggle(permission)}
                onLevel={(level) => setLevel(permission, level)}
                canGrantRead={canRead(permission)}
                canGrantWrite={canWrite(permission)}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
