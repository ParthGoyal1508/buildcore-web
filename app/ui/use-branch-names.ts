"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listBranchOptions,
  type BranchOption,
} from "@/app/lib/api/company-branches";

/**
 * The company's branches, inactive ones included, for screens that show which branch a project or
 * employee is on (041). The same query key the payroll run's branch picker uses, so it is one
 * request per screen at most.
 */
export function useBranches(companyId?: string | null) {
  const { data } = useQuery({
    queryKey: ["company-branches", "options", "all", companyId ?? null],
    queryFn: () => listBranchOptions(companyId, true),
  });
  const branches: BranchOption[] = data ?? [];
  const byId = new Map(branches.map((b) => [b.id, b]));
  return {
    branches,
    /** "Rewari (Haryana)", with "(head office)" after the head office; null while loading. */
    nameOf: (id: string | null | undefined) => {
      const b = id ? byId.get(id) : undefined;
      if (!b) return null;
      return b.isHeadOffice ? `${b.label} (head office)` : b.label;
    },
  };
}
