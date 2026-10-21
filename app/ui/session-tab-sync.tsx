"use client";

import { useEffect } from "react";

import { followSessionChanges } from "@/app/lib/session-tab";

/** Reloads this tab when another tab signs in or out — see `app/lib/session-tab.ts`. */
export default function SessionTabSync() {
  useEffect(() => followSessionChanges(), []);
  return null;
}
