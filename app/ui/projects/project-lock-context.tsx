'use client';

import { createContext, useContext } from 'react';

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
