"use client";

import {
  getItems,
  getStock,
  type Item,
  type StockRow,
} from "@/app/lib/api/inventory";
import {
  getVendors,
  type VendorListItem as Vendor,
} from "@/app/lib/api/partners";
import { getProjects, getSites, type Site } from "@/app/lib/api/projects";
import { inventoryLabel } from "@/app/lib/constants";
import { quantity } from "@/app/lib/format";
import type { AsyncSearchPage, SearchableOption } from "@/app/ui/async-select";

/**
 * Server searches for the inventory pickers, in the shape `<AsyncSelect search>` takes (036 M5).
 *
 * The pickers used to load one page of 200 (`use-inventory-refs.ts`) and offer what came back, so
 * the 201st item, vendor or store simply did not exist on any inventory form — it could not be
 * bought, issued, or even edited in Item masters. Each picker now asks the server as the person
 * types and pages through every match. The option builders are exported too, so a form opened on
 * an existing record can pass `selectedOption` for a value no page has loaded yet.
 *
 * Cache keys all start with `['inventory', …]` and vendors with `['inventory', 'vendors']`, which
 * is the prefix the Partners screens invalidate when a vendor is deactivated (036 N3).
 */
const PAGE = 25;

export const itemOption = (
  item: Pick<Item, "id" | "name" | "code" | "unit">,
): SearchableOption => ({
  id: item.id,
  label: item.name,
  sublabel: item.code,
  note: item.unit,
});

export const vendorOption = (
  vendor: Pick<Vendor, "id" | "name" | "code" | "type"> & {
    city?: string | null;
  },
): SearchableOption => ({
  id: vendor.id,
  label: vendor.name,
  sublabel: vendor.city ?? undefined,
  note: `${vendor.code} · ${inventoryLabel(vendor.type)}`,
});

export const siteOption = (
  site: Pick<Site, "id" | "name"> & { code?: string | null },
): SearchableOption => ({
  id: site.id,
  label: site.name,
  note: site.code ?? undefined,
});

/** Active items only: a retired item cannot be bought, issued or moved. */
export function searchItems(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  return getItems({
    search: term || undefined,
    active: true,
    page,
    pageSize: PAGE,
  }).then((r) => ({
    items: r.items.map(itemOption),
    total: r.total,
  }));
}

/** Active vendors only: an inactive vendor is refused on a purchase, payment or issue (036 M6). */
export function searchVendors(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  return getVendors({
    search: term || undefined,
    active: true,
    page,
    pageSize: PAGE,
  }).then((r) => ({
    items: r.items.map(vendorOption),
    total: r.total,
  }));
}

/** Stores — every project site. */
export function searchSites(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  return getSites({ search: term || undefined, page, pageSize: PAGE }).then(
    (r) => ({
      items: r.items.map(siteOption),
      total: r.total,
    }),
  );
}

export function searchProjects(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  return getProjects({ search: term || undefined, page, pageSize: PAGE }).then(
    (r) => ({
      items: r.items.map((project) => ({
        id: project.id,
        label: project.name,
        note: project.code ?? undefined,
      })),
      total: r.total,
    }),
  );
}

/**
 * What a store holds — for issuing or transferring out of it. The option's `note` is the quantity in
 * stock, so the person picks with the figure in front of them; `rows` hands back the stock rows for
 * the form's own hint.
 */
export function searchStoreStock(siteId: string) {
  return (
    term: string,
    page: number,
  ): Promise<AsyncSearchPage & { rows: StockRow[] }> =>
    getStock({ siteId, search: term || undefined, page, pageSize: PAGE }).then(
      (r) => ({
        rows: r.rows,
        items: r.rows.map((row) => ({
          id: row.itemId,
          label: row.itemName,
          sublabel: row.itemCode,
          note: `${quantity(row.inStock)} ${row.unit} in stock`,
        })),
        total: r.total,
      }),
    );
}
