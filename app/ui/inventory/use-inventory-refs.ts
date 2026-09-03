'use client';

import { useQuery } from '@tanstack/react-query';

import { getItems } from '@/app/lib/api/inventory';
import { getVendors } from '@/app/lib/api/partners';
import { getSites } from '@/app/lib/api/projects';

/**
 * The three dropdown sources every inventory form needs.
 *
 * Gathered here so each modal does not repeat the query keys, the page sizes and
 * the active-only filters — and so the whole module shares one cache entry per
 * source rather than refetching sites once per open modal.
 */

/** Every store, for the site pickers. Sites are few and the list is a dropdown, so
 * one page large enough to hold them all beats pagination nobody can use in a
 * `<select>`. */
export function useSites() {
  return useQuery({
    queryKey: ['inventory', 'sites'],
    queryFn: () => getSites({ pageSize: 200 }),
    select: (page) => page.items,
  });
}

/** Active vendors only: a retired supplier cannot be purchased from, and offering
 * one is a choice that ends in a validation error. */
export function useVendors() {
  return useQuery({
    queryKey: ['inventory', 'vendors'],
    queryFn: () => getVendors({ active: true, pageSize: 200 }),
    select: (page) => page.items,
  });
}

/** Active items only, for the same reason. */
export function useItems() {
  return useQuery({
    queryKey: ['inventory', 'items', { active: true }],
    queryFn: () => getItems({ active: true, pageSize: 200 }),
    select: (page) => page.items,
  });
}
