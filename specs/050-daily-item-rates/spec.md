# Feature Specification (web): Daily-Changing Item Rates (Diesel, Cement)

**Branch**: `050-daily-item-rates`
**Created**: 2026-10-29
**Source of truth**: `buildcore-api/specs/050-daily-item-rates/spec.md`. Every decision is in its Clarifications section.

**Input** (the user, verbatim, Hinglish): "there are some items whose rates are changing on a day basis, so we need an option to update those, like DIESEL or CEMENT, toh har baar vendor ki rate change karne padenge" (otherwise we'd have to change the vendor's rate every time).

## Screens

- **Inventory → Daily rates** (`app/dashboard/inventory/daily-rates/page.tsx`, new tab). "Update today's rates" is a date (today by default; past dates are allowed for corrections) and one table.
  - Each daily-rate item shows its market rate in force ("last set …") and an input prefilled with that rate, which is yesterday's until today's is saved.
  - Under each item, every vendor that has supplied it shows its rate in force ("follows market" or its own) and an input. The input is blank ("Same as market") unless the vendor's own rate is the one in force.
  - **Save rates** sends only the figures that changed. Clearing a vendor's own figure for that day sends `null`, which puts the vendor back on the market rate.
  - **History** opens the item's dated rates, newest first.
  - Without INVENTORY write, the inputs are read-only and Save is hidden.
- **Stock → Item masters** (`masters-modal.tsx`): "Rate changes daily" and "Machine fuel (diesel)" checkboxes. Fuel implies daily. A "Rate" column shows Daily / Daily · fuel.
- **New purchase** (`purchase-modal.tsx`): for a daily-rate item, the rate opens at the rate in force on the purchase date for the chosen vendor, with a hint naming the figure, whether it is the vendor's own, and the date it was set. It follows changes to the date or vendor until the person types a rate. Ordinary items are unchanged.
- **Record fuel** (`fuel-modal.tsx`): the rate per litre opens at the machine fuel item's rate for the entry date, the pump's own if it is newer, with a hint. Typing over it keeps the typed figure.
- **Purchase order** (`line-items-editor.tsx`, via `letters-panel.tsx`): a line added from the item master for a daily-rate item opens at today's rate for the PO's vendor, with "Daily rate ₹… (set …)" under the field.

## Clarifications

- Q: Where does the screen live? → A: As an Inventory tab, because it is gated by INVENTORY and is a daily task for the store and purchase desk. The item flags stay in the SETTINGS-owned item master. (decided by implementer, 2026-10-29, as the API spec records)
- Q: Should the prefilled rate overwrite a rate the person typed? → A: Never. The day's rate is shown only until a rate is typed. (decided by implementer, 2026-10-29, "still editable on the document")
- Q: How does it work at phone width? → A: The board is a desk screen (Principle VI desktop-first). At 320–360px the table scrolls inside its card, the page does not scroll sideways, and the inputs keep a minimum width. (decided by implementer, 2026-10-29)

## Verification

- `npm run lint` (0 errors; the 2 warnings are pre-existing) and `npm run typecheck` pass.
- Visual check (headless Chromium against the 050 API on a local scratch DB, 2026-10-29):
  - the board opened on yesterday's figures (cement 385; diesel 92.40, with one pump at its own 91.95 and one following the market);
  - after editing diesel to 93.15, cement to 390 and a pump to 92.80, Save showed "3 rates saved" and the board updated;
  - the History modal lists both days for the market and the pump;
  - New purchase for diesel from that pump opened at 92.80 with the hint;
  - Record fuel opened at 93.15 with the hint;
  - the item master shows both checkboxes and the Rate column;
  - a PO line for diesel opened at 92.8 with its hint, and a sand line stayed blank;
  - at 360px the page had no horizontal overflow.
