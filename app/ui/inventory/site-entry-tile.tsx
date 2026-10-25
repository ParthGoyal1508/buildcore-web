'use client';

import { CameraIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES, SITE_ENTRY_COPY } from '@/app/lib/constants';
import TileGrid from '@/app/ui/tile-grid';

/**
 * The way in to the site's delivery entry (043), on the Inventory index for those who hold
 * `INVENTORY_SITE_ENTRY` — Site Incharge. A client island so the index stays a server page; the
 * answer comes from the `['currentUser']` query the layout guard already made.
 */
export default function SiteEntryTile() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  if (!user?.permissions.includes('INVENTORY_SITE_ENTRY')) return null;
  return (
    <TileGrid
      tiles={[
        {
          name: SITE_ENTRY_COPY.title,
          href: ROUTES.inventorySiteEntry,
          icon: CameraIcon,
          description:
            'Record a delivery at your site with a live photo. Head Office completes it.',
        },
      ]}
    />
  );
}
