'use client';

import { createContext, useContext } from 'react';

import type { ProjectDetail } from '@/app/lib/api/projects';

const ProjectShellContext = createContext<ProjectDetail | null>(null);

/**
 * One project's aggregate, fetched once by the shell layout and read by every section under it.
 *
 * The six section pages each used to run their own `getProject` query for no reason but the
 * breadcrumb — six copies of the same request behind six copies of the same heading. The layout
 * now makes that request once and the sections read it from here, which is also what makes the
 * three read-only sections free: People, Machinery and Materials render arrays that have already
 * arrived.
 */
export function ProjectShellProvider({
  detail,
  children,
}: {
  detail: ProjectDetail;
  children: React.ReactNode;
}) {
  return (
    <ProjectShellContext.Provider value={detail}>
      {children}
    </ProjectShellContext.Provider>
  );
}

/**
 * The project this page belongs to.
 *
 * Throws rather than returning null when used outside the shell. A section page cannot render
 * anything useful without its project, and a silent null would turn that into an empty screen
 * somewhere further down instead of an error naming the component.
 */
export function useProjectShell(): ProjectDetail {
  const detail = useContext(ProjectShellContext);
  if (!detail) {
    throw new Error(
      'useProjectShell must be used inside the project shell layout',
    );
  }
  return detail;
}
