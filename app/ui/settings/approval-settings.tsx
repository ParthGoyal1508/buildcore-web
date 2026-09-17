'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getApprovalChains,
  getSlotMappings,
  putSlotMapping,
  type ApprovalChain,
} from '@/app/lib/api/approvals';
import { listRoles } from '@/app/lib/api/settings';
import { MESSAGES, approvalActionTypeLabel } from '@/app/lib/constants';
import { FormError, selectClass } from '@/app/ui/settings/form-fields';

/**
 * Slot-to-role mappings, and the chains that depend on them (feature 016 FR-001a, FR-021b).
 *
 * ## Why this screen exists
 *
 * A chain's levels name **slots**, not roles. `first_approver`, `hr`, `final` describe a
 * shape of authority; which of a company's own roles fills each one is a per-company
 * setting, because the client's "HR Office" and "Site Incharge" are not roles in this
 * system and two companies may staff the same shape differently.
 *
 * Until the mappings exist, nothing works — and it fails *quietly*. An attendance
 * exception enters its chain, waits at a level no role holds, and the only sign is the
 * reviewer being told "nobody can approve this yet". This screen is the remedy that
 * message points at.
 *
 * ## Saved one slot at a time, on purpose
 *
 * The backend refuses a mapping that would leave an active chain unable to complete —
 * two of its levels resolving to the same role, which under FR-021a means nobody can
 * decide both, so the chain stalls silently and permanently. The refusal names both
 * conflicting levels, and it is **shown verbatim**: a generic "could not save" would
 * throw away the only part of the message that says what to do.
 *
 * Saving one slot per request rather than the whole form is what makes that refusal
 * unambiguous. A bulk save would either half-apply or have to report which slot was the
 * problem, which is the same message with extra steps.
 */
export default function ApprovalSettings() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** Which slot is mid-save, so only that row's control disables. */
  const [saving, setSaving] = useState<string | null>(null);

  const slots = useQuery({
    queryKey: ['approvalSlotMappings'],
    queryFn: getSlotMappings,
  });
  const chains = useQuery({
    queryKey: ['approvalChains'],
    queryFn: getApprovalChains,
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles });

  const save = useMutation({
    mutationFn: putSlotMapping,
    onMutate: (input) => {
      setSaving(input.slotKey);
      setError(null);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approvalSlotMappings'] });
      // A newly-mapped slot changes what this caller can act on, so the badge and queue
      // are no longer accurate.
      void queryClient.invalidateQueries({ queryKey: ['approvalCount'] });
      void queryClient.invalidateQueries({ queryKey: ['approvalQueue'] });
    },
    onError: (e: unknown) => {
      // Verbatim. The unsatisfiable-chain refusal names the two conflicting levels, and
      // that naming is the entire value of the guard.
      setError(
        e instanceof Error
          ? e.message
          : 'The mapping could not be saved. Please try again.',
      );
    },
    onSettled: () => setSaving(null),
  });

  /**
   * Slot key → the role's name, resolved here rather than by the API.
   *
   * The approval endpoints return a `roleId` and no name: `Role` lives in the backend's
   * `settings` schema and the approval spine may not read it. This screen already holds
   * the roles list, so resolving it here costs nothing and keeps that boundary intact.
   */
  const roleForSlot = new Map(
    (slots.data ?? []).map((slot) => [
      slot.slotKey,
      slot.roleId
        ? roles.data?.find((r) => r.id === slot.roleId)?.name ?? null
        : null,
    ]),
  );

  const unmappedCount = (slots.data ?? []).filter((s) => !s.roleId).length;

  if (slots.isError || chains.isError || roles.isError) {
    return <FormError message={MESSAGES.loadFailed} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Stated before the form rather than beside a row. Somebody arriving here after
          being told "nobody can approve this yet" needs to know the scale of what is
          missing, not hunt for the empty dropdown. */}
      {unmappedCount > 0 && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {unmappedCount === 1
            ? 'One level has no role mapped to it. Items reaching that level cannot be approved by anybody until it does.'
            : `${unmappedCount} levels have no role mapped to them. Items reaching those levels cannot be approved by anybody until they do.`}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Who decides at each level
          </h2>
          <p className="text-sm text-gray-600">
            Every approval chain in the product resolves its levels through these.
            Changing one changes who may approve on every chain that uses it.
          </p>
        </div>

        <FormError message={error} />

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Approval level to role mapping</caption>
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Level
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Decided by
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slots.isLoading && (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {(slots.data ?? []).map((slot) => (
                <tr key={slot.slotKey}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      {slot.label}
                    </span>
                    {!slot.roleId && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                        not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <label
                      htmlFor={`slot-${slot.slotKey}`}
                      className="sr-only"
                    >
                      Role that decides at {slot.label}
                    </label>
                    <select
                      id={`slot-${slot.slotKey}`}
                      className={selectClass}
                      value={slot.roleId ?? ''}
                      disabled={saving === slot.slotKey || roles.isLoading}
                      onChange={(e) => {
                        const roleId = e.target.value;
                        // No "unset" option: the backend has no delete for a mapping,
                        // and offering one that silently did nothing would be worse
                        // than not offering it.
                        if (!roleId) return;
                        save.mutate({ slotKey: slot.slotKey, roleId });
                      }}
                    >
                      <option value="">
                        {saving === slot.slotKey ? 'Saving…' : 'Choose a role…'}
                      </option>
                      {(roles.data ?? []).map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Chains in this company
          </h2>
          <p className="text-sm text-gray-600">
            Read-only. Each chain’s levels resolve through the mappings above; a level
            whose slot is unset is flagged.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {chains.isLoading && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
          {(chains.data ?? [])
            // Active first, then superseded ones — those are kept because an item still
            // travelling a chain keeps the chain it entered.
            .slice()
            .sort((a, b) => Number(b.isActive) - Number(a.isActive))
            .map((chain) => (
              <ChainCard
                key={chain.id}
                chain={chain}
                roleForSlot={roleForSlot}
                slotLabel={(slotKey) =>
                  slots.data?.find((s) => s.slotKey === slotKey)?.label ??
                  slotKey
                }
              />
            ))}
          {chains.data?.length === 0 && (
            <p className="text-sm text-gray-600">
              No approval chains are defined for this company.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ChainCard({
  chain,
  roleForSlot,
  slotLabel,
}: {
  chain: ApprovalChain;
  /** Slot key → role name, or null where the slot is unmapped. */
  roleForSlot: Map<string, string | null>;
  slotLabel: (slotKey: string) => string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900">
          {approvalActionTypeLabel(chain.actionType)}
        </h3>
        {!chain.isActive && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            superseded
          </span>
        )}
      </div>
      <ol className="mt-2 space-y-1 text-sm">
        {chain.levels
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((level) => {
            const role = roleForSlot.get(level.slotKey) ?? null;
            return (
              <li key={level.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="w-4 shrink-0 text-xs tabular-nums text-gray-400">
                  {level.position}
                </span>
                <span className="text-gray-800">
                  {level.label ?? slotLabel(level.slotKey)}
                </span>
                {/* The resolved role, so an administrator can read the chain as staffed
                    rather than as shaped — "HR Office" means nothing without knowing
                    which of this company's roles it currently is. */}
                {role ? (
                  <span className="text-xs text-gray-500">{role}</span>
                ) : (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                    no role set
                  </span>
                )}
                {level.isFinalAuthority && (
                  <span className="text-xs text-gray-500">· final authority</span>
                )}
              </li>
            );
          })}
      </ol>
    </div>
  );
}
