/**
 * Keeps every open tab on the same person (039, 2026-10-21).
 *
 * One browser holds one session: the login cookie is shared by all its tabs. Signing in as someone
 * else in one tab therefore turned every other tab into that person too, while those tabs still
 * showed the first person's screens and believed in the first person's company — so they raised
 * "Company was changed in another tab" (found signing in as Rakesh Agarwal, then Mohit Agrawal, in
 * two tabs). The company banner was right that something changed and wrong about what.
 *
 * So a sign-in or sign-out is announced, and every other tab reloads: onto the new person's own
 * screens, or onto the login page after a sign-out. Testing two roles side by side needs two
 * browser profiles or a private window, which is what a shared cookie means anyway.
 */
const CHANNEL = "tirupati-session";

function open(): BroadcastChannel | null {
  return typeof window !== "undefined" &&
    typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL)
    : null;
}

/** Tells the other tabs this one just signed in or out. A channel never echoes to its sender. */
export function announceSessionChange(kind: "signed-in" | "signed-out"): void {
  const channel = open();
  channel?.postMessage({ kind });
  channel?.close();
}

/** Reloads this tab when another one signs in or out. Returns the unsubscribe. */
export function followSessionChanges(): () => void {
  const channel = open();
  if (!channel) return () => {};
  channel.addEventListener("message", () => window.location.reload());
  return () => channel.close();
}
