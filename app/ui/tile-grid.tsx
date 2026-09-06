import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

/**
 * One tile on a module's landing screen.
 *
 * `icon` is required rather than optional, which is the whole point of this type:
 * four modules landed with icons on their tiles and six without, so which modules
 * looked finished came down to which week they were built in. A module cannot now
 * ship a tile without one — it fails to compile instead.
 */
export interface Tile {
  name: string;
  href: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * The grid of tiles a module lands on (HR, Projects, Plant, Inventory, Assets,
 * Partners, Labour, Recruitment, Settings, My Workspace).
 *
 * Every one of those had its own copy of this markup, and they had drifted into four
 * different cards: flat grey with an icon, bordered white without, bordered white with
 * a shadow and a smaller, greyer description, and a borderless one with a base-size
 * title. Same component, same job, four appearances. This is the one card.
 *
 * Permission filtering stays with the caller. Each module decides what a user may see
 * from its own permission set, and folding that in here would mean this component
 * knowing about every module's permissions.
 */
export default function TileGrid({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link
            key={tile.href}
            href={tile.href}
            className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <Icon
              className="h-6 w-6 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">
                {tile.name}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{tile.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
