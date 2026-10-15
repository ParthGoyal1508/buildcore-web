'use client';

/**
 * The `<option>`s of a plant vendor picker: hire vendors first, then everyone else.
 *
 * Shared by the hire bill and the hire order (2026-10-15) so the two supplier pickers
 * cannot drift apart. Hire vendors lead because they are the answer nearly every time;
 * the rest stay offered because a supplier's type in Partners is often left at its default.
 */
export default function VendorOptions({
  vendors,
}: {
  vendors: { id: string; name: string; type: string }[];
}) {
  const hire = vendors.filter((v) => v.type === 'hire');
  const other = vendors.filter((v) => v.type !== 'hire');
  return (
    <>
      {hire.length > 0 && (
        <optgroup label="Hire vendors">
          {hire.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </optgroup>
      )}
      {other.length > 0 && (
        <optgroup label="Other vendors">
          {other.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
