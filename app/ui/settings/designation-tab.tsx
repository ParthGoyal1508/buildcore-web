'use client';

import {
  createDesignation,
  deleteDesignation,
  listDesignations,
  updateDesignation,
} from '@/app/lib/api/settings';
import NamedReferenceTab from '@/app/ui/settings/named-reference-tab';

export default function DesignationTab() {
  return (
    <NamedReferenceTab
      resource="designations"
      singular="Designation"
      plural="Designations"
      api={{
        list: listDesignations,
        create: createDesignation,
        update: updateDesignation,
        remove: deleteDesignation,
      }}
    />
  );
}
