'use client';

import { useQuery } from '@tanstack/react-query';

import { getMyProfile } from '@/app/lib/api/my-workspace';
import { getCurrentUser } from '@/app/lib/api/users';

/**
 * Who the signed-in approver is, for maker-checker (036 F19).
 *
 * The API refuses with 403 `SELF_APPROVAL` when the person approving an advance or loan recorded
 * it, or is the employee receiving it. Screens use this to not offer Approve in those cases, so the
 * refusal is explained before it is met. `employeeCode` is null for an account with no employee
 * record (the profile 404s); nothing is hidden then, and the server still decides.
 */
export function useApproverSelf() {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const profile = useQuery({
    queryKey: ['my', 'profile'],
    queryFn: getMyProfile,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const userId = user.data?.id ?? null;
  const employeeCode = profile.data?.employeeCode ?? null;
  return {
    /** Whether this person may not approve a row they recorded or that pays them. */
    isSelf: (row: { createdByUserId?: string | null; employeeCode?: string | null }) =>
      Boolean(
        (userId && row.createdByUserId === userId) ||
          (employeeCode && row.employeeCode === employeeCode),
      ),
  };
}
