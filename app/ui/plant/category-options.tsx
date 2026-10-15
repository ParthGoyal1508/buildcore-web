import type { EquipmentCategory } from '@/app/lib/api/plant';

const UNGROUPED = 'Other';

/**
 * Equipment categories as `<optgroup>`s by their family (2026-10-15).
 *
 * The imported master list brought some three hundred categories under eleven families; a flat
 * list of that length is a scroll, while the families are how the client's own sheet reads.
 * Families sort by name with the ungrouped ones last as "Other", categories by name within each.
 */
export default function CategoryOptions({
  categories,
}: {
  categories: EquipmentCategory[];
}) {
  const groups = new Map<string, EquipmentCategory[]>();
  for (const category of categories) {
    const key = category.group?.trim() || UNGROUPED;
    groups.set(key, [...(groups.get(key) ?? []), category]);
  }
  const names = [...groups.keys()].sort((a, b) =>
    a === UNGROUPED ? 1 : b === UNGROUPED ? -1 : a.localeCompare(b),
  );
  return (
    <>
      {names.map((group) => (
        <optgroup key={group} label={group}>
          {groups
            .get(group)!
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
