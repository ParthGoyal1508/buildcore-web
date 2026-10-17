'use client';

import { createContext, useContext } from 'react';

import { errorMessage } from '@/app/lib/api/client';

/**
 * Whether the project currently on screen is locked (spec FR-003).
 *
 * A context rather than a prop threaded through every tab, because the consumers are
 * scattered: each write control on each tab of the project detail has to disable
 * itself, and a prop chain that deep is one component away from someone forgetting
 * a link in it — which shows up as a button that looks enabled and 423s on click.
 *
 * Read-only by design: nothing inside a project's tabs may change the lock. Locking
 * and unlocking happen on the edit form, which refetches afterwards so the new value
 * arrives through the provider rather than through local state that could disagree
 * with the server.
 *
 * The default is *unlocked*, which is the safe direction for a default here: the
 * server enforces the rule regardless (`ProjectLockGuard` → 423), so a control
 * wrongly enabled produces a clear refusal, whereas a control wrongly disabled with
 * no project in scope would silently break every unrelated screen that renders one.
 */
export interface ProjectLockState {
  projectId: string | null;
  isLocked: boolean;
}

const ProjectLockContext = createContext<ProjectLockState>({
  projectId: null,
  isLocked: false,
});

export function ProjectLockProvider({
  projectId,
  isLocked,
  children,
}: ProjectLockState & { children: React.ReactNode }) {
  return (
    <ProjectLockContext.Provider value={{ projectId, isLocked }}>
      {children}
    </ProjectLockContext.Provider>
  );
}

export function useProjectLock(): ProjectLockState {
  return useContext(ProjectLockContext);
}

/** HTTP 423 — the API's refusal of a write to a locked project (`ProjectLockGuard`). */
export const HTTP_PROJECT_LOCKED = 423;

/**
 * What a locked project's refusal says, everywhere (036 Wave 3, stream 3c).
 *
 * Since 036 I1/I2 the lock is enforced on every DWR, bill-package, RA bill, client bill, work order,
 * project-document and project-delete write. Several screens rendered the 423 as "something went
 * wrong", which sends a person to an administrator about a permission they already have.
 */
export const PROJECT_LOCKED_MESSAGE =
  'This project is locked, so nothing can be changed on it. Unlock it first — this is not a permission problem.';

export function isProjectLockedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === HTTP_PROJECT_LOCKED
  );
}

/**
 * The text for a refused project write: the lock sentence for a 423, otherwise the server's own
 * message (`errorMessage`), otherwise `fallback`.
 */
export function projectErrorMessage(
  error: unknown,
  fallback = 'The change could not be saved. Please try again.',
): string {
  if (isProjectLockedError(error)) return PROJECT_LOCKED_MESSAGE;
  return errorMessage(error, fallback);
}
