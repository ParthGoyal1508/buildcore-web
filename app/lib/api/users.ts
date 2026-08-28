import { z } from 'zod';
import { authFetch } from '@/app/lib/session';

const currentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  firstname: z.string().nullable().optional(),
  lastname: z.string().nullable().optional(),
  roleNames: z.array(z.string()),
  permissions: z.array(z.string()),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

/**
 * The authoritative answer to "who is signed in right now" — resolved from
 * the session itself on every call, never from a URL or cached copy that
 * could outlive the session that produced it.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const raw = await authFetch<unknown>('/users/me');
  return currentUserSchema.parse(raw);
}

/** Mirrors the backend's own display-name rule (auth.service.ts). */
export function displayName(user: CurrentUser): string {
  const full = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
  return full || user.username;
}
