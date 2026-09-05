'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getAssetCategories,
  getAssetDocTypes,
  getAssets,
  getConditionGrades,
} from '@/app/lib/api/assets';
import { getProjects, getSites } from '@/app/lib/api/projects';
import { getCurrentUser } from '@/app/lib/api/users';
import { getVendors } from '@/app/lib/api/partners';
import { useCompanyContext } from '@/app/ui/settings/company-context';

/**
 * The dropdown sources and permission checks every Assets screen needs.
 *
 * Gathered here so each modal does not repeat the query keys, the page sizes and the
 * active-only filters — and so the whole module shares one cache entry per source
 * rather than refetching the category list once per open modal. Directly modelled on
 * `use-plant-refs.ts`.
 *
 * Every one is scoped to the company `CompanyProvider` selected in the layout.
 * Without that a cross-company administrator sees every tenant's rows mixed together
 * — seven asset categories across three companies renders as twenty-one rows named
 * in triplicate, with nothing saying which is which.
 */
export function useAssetsCompanyId(): string | null {
  return useCompanyContext().companyId;
}

/**
 * Whether the signed-in user may take the approval-only actions (spec FR-003).
 *
 * Resolves from the same `['currentUser']` cache entry the sidebar and `ModuleGuard`
 * already populated, so nothing flashes while a second request lands. Actions gated
 * on this are **not rendered** rather than rendered-and-disabled: a disabled control
 * for a permission a user will never hold is a permanent invitation to ask why.
 */
export function useAssetsApprove(): boolean {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  return (user?.permissions ?? []).includes('ASSETS_APPROVE' as never);
}

/** Whether the user may edit the company masters — a `SETTINGS` job, not an
 * `ASSETS` one, matching the backend's guard on those routes. */
export function useAssetsMastersAccess(): boolean {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  return (user?.permissions ?? []).includes('SETTINGS' as never);
}

/** Active categories only: a retired category cannot take a new asset, and offering
 * one is a choice that ends in a validation error. */
export function useAssetCategories() {
  const companyId = useAssetsCompanyId();
  return useQuery({
    queryKey: ['assets', 'categories', companyId],
    queryFn: () => getAssetCategories(companyId ?? undefined),
    select: (rows) => rows.filter((row) => row.active),
  });
}

/** Every category including retired ones — the masters table has to show what it is
 * about to let someone reactivate. */
export function useAllAssetCategories() {
  const companyId = useAssetsCompanyId();
  return useQuery({
    queryKey: ['assets', 'categories', 'all', companyId],
    queryFn: () => getAssetCategories(companyId ?? undefined),
  });
}

export function useAssetDocTypes() {
  const companyId = useAssetsCompanyId();
  return useQuery({
    queryKey: ['assets', 'doc-types', companyId],
    queryFn: () => getAssetDocTypes(companyId ?? undefined),
    select: (rows) => rows.filter((row) => row.active),
  });
}

/** Active grades, best first — the order the API returns them in and the order a
 * return dropdown reads best in. */
export function useConditionGrades() {
  const companyId = useAssetsCompanyId();
  return useQuery({
    queryKey: ['assets', 'condition-grades', companyId],
    queryFn: () => getConditionGrades(companyId ?? undefined),
    select: (rows) => rows.filter((row) => row.active),
  });
}

/** Every asset, for the allocation picker. One page large enough to hold them all:
 * pagination is unusable in a `<select>`. */
export function useAllAssets() {
  const companyId = useAssetsCompanyId();
  return useQuery({
    queryKey: ['assets', 'register', 'all', companyId],
    queryFn: () =>
      getAssets({ pageSize: 200, ...(companyId ? { companyId } : {}) }),
    select: (page) => page.items,
  });
}

export function useAssetSites() {
  return useQuery({
    queryKey: ['assets', 'sites'],
    queryFn: () => getSites({ pageSize: 200 }),
    select: (page) => page.items,
  });
}

export function useAssetProjects() {
  return useQuery({
    queryKey: ['assets', 'projects'],
    queryFn: () => getProjects({ pageSize: 200 }),
    select: (page) => page.items,
  });
}

/** Shared with Plant's and Inventory's own hooks by intent, not by import: the three
 * modules key their caches separately so one invalidating its vendor list does not
 * refetch the others'. */
export function useAssetVendors() {
  return useQuery({
    queryKey: ['assets', 'vendors'],
    queryFn: () => getVendors({ active: true, pageSize: 200 }),
    select: (page) => page.items,
  });
}
