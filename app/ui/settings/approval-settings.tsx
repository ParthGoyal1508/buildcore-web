'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  getApprovalChains,
  getSlotMappings,
  putSlotMapping,
  replaceApprovalChain,
  type ApprovalChain,
  type ApprovalSlotMapping,
  type ChainLevelInput,
} from '@/app/lib/api/approvals';
import { listRoles, type Role } from '@/app/lib/api/settings';
import { approvalActionTypeLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import QueryError from '@/app/ui/query-error';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  selectClass,
  fieldClass,
} from '@/app/ui/settings/form-fields';
import { TABLE } from '@/app/ui/table';
import { LoadingText } from '@/app/ui/spinner';
import { toast } from '@/app/ui/toast';

/** "3 people hold it here", or the warning that nobody does (036 C11). */
function holdersText(role: Role | undefined): string | null {
  if (role?.activeHolderCount === undefined) return null;
  const n = role.activeHolderCount;
  if (n === 0) return 'Nobody in this company holds this role';
  return `${n} ${n === 1 ? 'person holds' : 'people hold'} it here`;
}

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
      toast.success('Approval level updated.');
      void queryClient.invalidateQueries({
        queryKey: ['approvalSlotMappings'],
      });
      // A newly-mapped slot changes what this caller can act on, so the badge and queue
      // are no longer accurate.
      void queryClient.invalidateQueries({ queryKey: ['approvalCount'] });
      void queryClient.invalidateQueries({ queryKey: ['approvalQueue'] });
    },
    onError: (e: unknown) => {
      // Verbatim. The unsatisfiable-chain refusal names the two conflicting levels, and
      // that naming is the entire value of the guard.
      setError(
        errorMessage(e, 'The mapping could not be saved. Please try again.'),
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
        ? (roles.data?.find((r) => r.id === slot.roleId)?.name ?? null)
        : null,
    ]),
  );

  const unmappedCount = (slots.data ?? []).filter((s) => !s.roleId).length;
  const [editingChain, setEditingChain] = useState<ApprovalChain | null>(null);

  /**
   * 036 C11: a level's role changed on a bare `onChange`, with no confirmation and no hint that
   * the new role might have nobody holding it — which stalls every item that reaches that level
   * across every chain using it. Now it says which chains change and how many people can decide.
   */
  const changeSlot = async (slot: ApprovalSlotMapping, roleId: string) => {
    const from = roles.data?.find((r) => r.id === slot.roleId);
    const to = roles.data?.find((r) => r.id === roleId);
    const affected = (chains.data ?? []).filter(
      (chain) =>
        chain.isActive && chain.levels.some((l) => l.slotKey === slot.slotKey),
    );
    const chainNames = affected
      .map((chain) => approvalActionTypeLabel(chain.actionType))
      .join(', ');
    const holders = holdersText(to);
    const nobody = to?.activeHolderCount === 0;
    const ok = await confirmDialog({
      title: `Change who decides at ${slot.label}?`,
      message: [
        `${from ? `From ${from.name} to` : 'Set to'} ${to?.name ?? 'this role'}.`,
        affected.length
          ? `This changes ${affected.length} active chain${affected.length === 1 ? '' : 's'}: ${chainNames}. Items already waiting at this level move to the new role.`
          : 'No active chain uses this level yet.',
        holders
          ? nobody
            ? `${holders} — items reaching this level will wait until someone is given it.`
            : `${holders}.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Change',
      tone: nobody ? 'danger' : undefined,
    });
    if (ok) save.mutate({ slotKey: slot.slotKey, roleId });
  };

  const failed = [slots, chains, roles].find((q) => q.isError);
  if (failed) {
    return (
      <QueryError
        error={failed.error}
        onRetry={() =>
          Promise.all([slots.refetch(), chains.refetch(), roles.refetch()])
        }
      />
    );
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
            Every approval chain in the product resolves its levels through
            these. Changing one changes who may approve on every chain that uses
            it.
          </p>
        </div>

        <FormError message={error} />

        <div className={TABLE.wrap}>
          <table className={`${TABLE.table} w-full`}>
            <caption className="sr-only">
              Approval level to role mapping
            </caption>
            <thead className={TABLE.thead}>
              <tr>
                <th scope="col" className={TABLE.th}>
                  Level
                </th>
                <th scope="col" className={TABLE.th}>
                  Decided by
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.isLoading && (
                <tr className={TABLE.row}>
                  <td colSpan={2} className={`${TABLE.td} text-gray-500`}>
                    <LoadingText />
                  </td>
                </tr>
              )}
              {(slots.data ?? []).map((slot) => (
                <tr key={slot.slotKey} className={TABLE.row}>
                  <td className={TABLE.td}>
                    <span className="font-medium text-gray-900">
                      {slot.label}
                    </span>
                    {!slot.roleId && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                        not set
                      </span>
                    )}
                  </td>
                  <td className={TABLE.td}>
                    <label htmlFor={`slot-${slot.slotKey}`} className="sr-only">
                      Role that decides at {slot.label}
                    </label>
                    <select
                      id={`slot-${slot.slotKey}`}
                      className={selectClass}
                      value={slot.roleId ?? ''}
                      disabled={saving === slot.slotKey || roles.isLoading}
                      aria-describedby={`slot-${slot.slotKey}-holders`}
                      onChange={(e) => {
                        const roleId = e.target.value;
                        // No "unset" option: the backend has no delete for a mapping,
                        // and offering one that silently did nothing would be worse
                        // than not offering it.
                        if (!roleId || roleId === slot.roleId) return;
                        void changeSlot(slot, roleId);
                      }}
                    >
                      <option value="">
                        {saving === slot.slotKey ? 'Saving…' : 'Choose a role…'}
                      </option>
                      {(roles.data ?? []).map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                          {role.activeHolderCount === 0 ? ' (nobody holds it here)' : ''}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const text = holdersText(
                        roles.data?.find((r) => r.id === slot.roleId),
                      );
                      if (!slot.roleId || !text) return null;
                      const nobody = text.startsWith('Nobody');
                      return (
                        <p
                          id={`slot-${slot.slotKey}-holders`}
                          className={`mt-1 text-xs ${nobody ? 'text-amber-800' : 'text-gray-500'}`}
                        >
                          {text}
                          {nobody && ' — items reaching this level will wait.'}
                        </p>
                      );
                    })()}
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
            Each chain’s levels resolve through the mappings above; a level whose
            slot is unset is flagged. Editing a chain’s levels applies to items
            submitted from then on — items already travelling keep the levels
            they started with.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {chains.isLoading && (
            <p className="text-sm text-gray-500">
              <LoadingText />
            </p>
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
                onEdit={chain.isActive ? () => setEditingChain(chain) : undefined}
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

      {editingChain && (
        <ChainEditor
          chain={editingChain}
          slots={slots.data ?? []}
          onClose={() => setEditingChain(null)}
        />
      )}
    </div>
  );
}

type DraftLevel = { slotKey: string; isFinalAuthority: boolean; label: string };

/**
 * A chain's levels, edited (036 C11). The API supported replacing a chain all along
 * (`PUT /approvals/chains/:id`), and the screen showed chains read-only.
 *
 * Saving supersedes: the old chain stays for the items already on it, and new items take these
 * levels. The server refuses a chain two of whose levels resolve to the same role, or with more
 * than one final authority; its message is shown as is.
 */
function ChainEditor({
  chain,
  slots,
  onClose,
}: {
  chain: ApprovalChain;
  slots: ApprovalSlotMapping[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const initial: DraftLevel[] = chain.levels
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((l) => ({
      slotKey: l.slotKey,
      isFinalAuthority: l.isFinalAuthority,
      label: l.label ?? '',
    }));
  const [levels, setLevels] = useState<DraftLevel[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const isDirty = JSON.stringify(levels) !== JSON.stringify(initial);

  const save = useMutation({
    mutationFn: () =>
      replaceApprovalChain(
        chain,
        levels.map<ChainLevelInput>((level, index) => ({
          position: index + 1,
          slotKey: level.slotKey,
          isFinalAuthority: level.isFinalAuthority || undefined,
          label: level.label.trim() || undefined,
        })),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approvalChains'] });
      toast.success(`${approvalActionTypeLabel(chain.actionType)} chain saved.`);
      onClose();
    },
    onError: (e: unknown) =>
      setError(errorMessage(e, 'The chain could not be saved.')),
  });

  const update = (index: number, patch: Partial<DraftLevel>) =>
    setLevels((current) =>
      current.map((level, i) =>
        i === index
          ? { ...level, ...patch }
          : // One final authority per chain: choosing one clears the others.
            patch.isFinalAuthority
            ? { ...level, isFinalAuthority: false }
            : level,
      ),
    );
  const move = (index: number, by: -1 | 1) =>
    setLevels((current) => {
      const next = current.slice();
      const [level] = next.splice(index, 1);
      next.splice(index + by, 0, level);
      return next;
    });

  const submit = async () => {
    setError(null);
    if (levels.length === 0) {
      setError('A chain needs at least one level.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Save these levels?',
      message:
        'Items submitted from now on follow the new levels. Items already waiting keep the levels they started with.',
      confirmLabel: 'Save',
    });
    if (ok) save.mutate();
  };

  return (
    <Modal
      title={`Levels: ${approvalActionTypeLabel(chain.actionType)}`}
      onClose={onClose}
      isDirty={isDirty}
      pending={save.isPending}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={save.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => void submit()}
            loading={save.isPending}
            disabled={!isDirty}
          >
            Save levels
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <ol className="space-y-3">
          {levels.map((level, index) => (
            <li
              key={index}
              className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-[2rem_1fr_1fr_auto] sm:items-center"
            >
              <span className="text-sm tabular-nums text-gray-500">{index + 1}</span>
              <div>
                <label htmlFor={`level-slot-${index}`} className="sr-only">
                  Level {index + 1} decided by
                </label>
                <select
                  id={`level-slot-${index}`}
                  className={selectClass}
                  value={level.slotKey}
                  onChange={(e) => update(index, { slotKey: e.target.value })}
                >
                  {slots.map((slot) => (
                    <option key={slot.slotKey} value={slot.slotKey}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`level-label-${index}`} className="sr-only">
                  Level {index + 1} name on this chain (optional)
                </label>
                <input
                  id={`level-label-${index}`}
                  className={fieldClass}
                  placeholder="Name on this chain (optional)"
                  maxLength={100}
                  value={level.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="final-authority"
                    checked={level.isFinalAuthority}
                    onChange={() => update(index, { isFinalAuthority: true })}
                  />
                  Final authority
                </label>
                <RowAction
                  type="button"
                  icon={null}
                  aria-label={`Move level ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </RowAction>
                <RowAction
                  type="button"
                  icon={null}
                  aria-label={`Move level ${index + 1} down`}
                  disabled={index === levels.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </RowAction>
                <RowAction
                  type="button"
                  onClick={() =>
                    setLevels((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </RowAction>
              </div>
            </li>
          ))}
        </ol>
        {levels.some((l) => l.isFinalAuthority) && (
          <SecondaryButton
            type="button"
            onClick={() =>
              setLevels((current) =>
                current.map((l) => ({ ...l, isFinalAuthority: false })),
              )
            }
          >
            Clear final authority
          </SecondaryButton>
        )}
        <SecondaryButton
          type="button"
          disabled={slots.length === 0}
          onClick={() =>
            setLevels((current) => [
              ...current,
              { slotKey: slots[0]?.slotKey ?? '', isFinalAuthority: false, label: '' },
            ])
          }
        >
          Add level
        </SecondaryButton>
      </div>
    </Modal>
  );
}

function ChainCard({
  chain,
  onEdit,
  roleForSlot,
  slotLabel,
}: {
  chain: ApprovalChain;
  onEdit?: () => void;
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
        {onEdit && (
          <RowAction type="button" onClick={onEdit}>
            Edit levels
          </RowAction>
        )}
      </div>
      <ol className="mt-2 space-y-1 text-sm">
        {chain.levels
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((level) => {
            const role = roleForSlot.get(level.slotKey) ?? null;
            return (
              <li
                key={level.id}
                className="flex flex-wrap items-baseline gap-x-2"
              >
                <span className="w-4 shrink-0 text-xs tabular-nums text-gray-500">
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
                  <span className="text-xs text-gray-500">
                    · final authority
                  </span>
                )}
              </li>
            );
          })}
      </ol>
    </div>
  );
}
