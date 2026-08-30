'use client';

import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from '@/app/lib/api/settings';
import NamedReferenceTab from '@/app/ui/settings/named-reference-tab';

export default function DepartmentTab() {
  return (
    <NamedReferenceTab
      resource="departments"
      singular="Department"
      plural="Departments"
      api={{
        list: listDepartments,
        create: createDepartment,
        update: updateDepartment,
        remove: deleteDepartment,
      }}
    />
  );
}
