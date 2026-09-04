'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getEquipment,
  getEquipmentCategories,
  getEquipmentDocTypes,
  getSpareParts,
} from '@/app/lib/api/plant';
import { getVendors } from '@/app/lib/api/partners';
import { getSites } from '@/app/lib/api/projects';
import { useCompanyContext } from '@/app/ui/settings/company-context';

/**
 * The dropdown sources every plant form needs.
 *
 * Gathered here so each modal does not repeat the query keys, the page sizes and the
 * active-only filters — and so the whole module shares one cache entry per source
 * rather than refetching the machine list once per open modal.
 *
 * Every one is scoped to the company selected in `CompanyProvider`, which the plant
 * layout mounts. Without that, a cross-company administrator sees every tenant's
 * rows mixed together in one list — ten equipment categories across three companies
 * renders as thirty rows named in triplicate, with nothing saying which is which.
 * `companyScope()` on the backend widens deliberately for such a caller; naming the
 * company is how the client narrows it back.
 *
 * `companyId` is part of every query key, so switching company refetches rather than
 * showing the previous company's list from cache.
 */
export function usePlantCompanyId(): string | null {
  return useCompanyContext().companyId;
}

/** Every machine, for the equipment pickers. One page large enough to hold them all:
 * a yard has tens, not thousands, and pagination is unusable in a `<select>`. */
export function usePlantEquipment() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'equipment', 'all', companyId],
    queryFn: () =>
      getEquipment({ pageSize: 200, ...(companyId ? { companyId } : {}) }),
    select: (page) => page.items,
  });
}

/** Active categories only: a retired category cannot take a new machine, and
 * offering one is a choice that ends in a validation error. */
export function usePlantCategories() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'categories', companyId],
    queryFn: () => getEquipmentCategories(companyId ?? undefined),
    select: (rows) => rows.filter((row) => row.active),
  });
}

/** Active document types only, for the same reason. */
export function usePlantDocTypes() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'doc-types', companyId],
    queryFn: () => getEquipmentDocTypes(companyId ?? undefined),
    select: (rows) => rows.filter((row) => row.active),
  });
}

export function usePlantSpareParts() {
  const companyId = usePlantCompanyId();
  return useQuery({
    queryKey: ['plant', 'spare-parts', 'all', companyId],
    queryFn: () =>
      getSpareParts({ pageSize: 200, ...(companyId ? { companyId } : {}) }),
    select: (page) => page.items.filter((row) => row.active),
  });
}

/** Shared with Inventory's own hook by intent, not by import: the two modules key
 * their caches separately so one invalidating its vendor list does not refetch the
 * other's. */
export function usePlantVendors() {
  return useQuery({
    queryKey: ['plant', 'vendors'],
    queryFn: () => getVendors({ active: true, pageSize: 200 }),
    select: (page) => page.items,
  });
}

export function usePlantSites() {
  return useQuery({
    queryKey: ['plant', 'sites'],
    queryFn: () => getSites({ pageSize: 200 }),
    select: (page) => page.items,
  });
}
