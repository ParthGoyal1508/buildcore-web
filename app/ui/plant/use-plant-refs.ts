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

/**
 * The dropdown sources every plant form needs.
 *
 * Gathered here so each modal does not repeat the query keys, the page sizes and the
 * active-only filters — and so the whole module shares one cache entry per source
 * rather than refetching the machine list once per open modal.
 */

/** Every machine, for the equipment pickers. One page large enough to hold them all:
 * a yard has tens, not thousands, and pagination is unusable in a `<select>`. */
export function usePlantEquipment() {
  return useQuery({
    queryKey: ['plant', 'equipment', 'all'],
    queryFn: () => getEquipment({ pageSize: 200 }),
    select: (page) => page.items,
  });
}

/** Active categories only: a retired category cannot take a new machine, and
 * offering one is a choice that ends in a validation error. */
export function usePlantCategories() {
  return useQuery({
    queryKey: ['plant', 'categories'],
    queryFn: getEquipmentCategories,
    select: (rows) => rows.filter((row) => row.active),
  });
}

/** Active document types only, for the same reason. */
export function usePlantDocTypes() {
  return useQuery({
    queryKey: ['plant', 'doc-types'],
    queryFn: getEquipmentDocTypes,
    select: (rows) => rows.filter((row) => row.active),
  });
}

export function usePlantSpareParts() {
  return useQuery({
    queryKey: ['plant', 'spare-parts', 'all'],
    queryFn: () => getSpareParts({ pageSize: 200 }),
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
