export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  changePassword: '/change-password',
} as const;

export const MESSAGES = {
  invalidCredentials: 'Invalid email or password',
  welcomeBack: (name: string) => `Welcome back, ${name}!`,
  lockoutFallback: 'Account temporarily locked. Try again later.',
  rateLimited: 'Too many attempts. Please try again later.',
} as const;

/**
 * The backend's 423 response bakes the unlock time into its message as a raw
 * ISO timestamp (auth.service.ts). Reformat it for display rather than
 * showing backend text verbatim (mirrors the 401 case, where the frontend
 * owns its own copy regardless of what the backend returned).
 */
export function formatLockoutMessage(rawMessage: string): string {
  const match = rawMessage.match(/after (.+)\.$/);
  if (!match) return MESSAGES.lockoutFallback;
  const unlockTime = new Date(match[1]);
  if (Number.isNaN(unlockTime.getTime())) return MESSAGES.lockoutFallback;
  return `Account temporarily locked. Try again after ${unlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}
