'use client';

import { useQuery } from '@tanstack/react-query';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';

import {
  getEquipment,
  getEquipmentCategories,
  getEquipmentDocTypes,
  getSpareParts,
} from '@/app/lib/api/plant';

/**
 * The dropdown sources every plant form needs.
 *
 * Gathered here so each modal does not repeat the query keys, the page sizes and the
 * active-only filters — and so the whole module shares one cache entry per source
 * rather than refetching the machine list once per open modal.
 *
 * Every one is scoped to the company the **session** is in, read through
 * `useSelectedCompanyId()`. Without any scoping a cross-company administrator sees every
 * tenant's rows mixed together — ten equipment categories across three companies renders
 * as thirty rows named in triplicate, with nothing saying which is which.
 *
 * This used to come from `CompanyProvider`, which held it in `useState` and never told the
 * server, so the interface and the data could disagree about which company was current.
 * The hook is kept as the seam rather than removed: fourteen plant screens read it, and
 * re-pointing one function at the server was the smaller and safer change than editing all
 * of them. What it returns is now the server's own answer, so the id these queries send is
 * no longer a second opinion — `companyScope()` validates it either way.
 *
 * `companyId` stays in every query key, which is belt to the brace of the cache clear a
 * company switch performs.
 */
export function usePlantCompanyId(): string | null {
  return useSelectedCompanyId();
}

/** Every machine, for the equipment pickers. One page large enough to hold them all:
 * a yard has tens, not thousands, and pagination is unusable in a `<select>`. */
export function usePlantEquipment() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'equipment', 'all', companyId],
    queryFn: () => getEquipment({ pageSize: 200 }),
    select: (page) => page.items,
  });
}

/** Active categories only: a retired category cannot take a new machine, and
 * offering one is a choice that ends in a validation error. */
export function usePlantCategories() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'categories', companyId],
    queryFn: () => getEquipmentCategories(),
    select: (rows) => rows.filter((row) => row.active),
  });
}

/** Active document types only, for the same reason. */
export function usePlantDocTypes() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'doc-types', companyId],
    queryFn: () => getEquipmentDocTypes(),
    select: (rows) => rows.filter((row) => row.active),
  });
}

export function usePlantSpareParts() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'spare-parts', 'all', companyId],
    queryFn: () => getSpareParts({ pageSize: 200 }),
    select: (page) => page.items.filter((row) => row.active),
  });
}

// `usePlantVendors` and `usePlantSites` lived here until 042: one page of 200 into a `<select>`,
// so the 201st vendor or site did not exist on the form. Their consumers use the server-searched
// pickers in `pickers.tsx` now.
