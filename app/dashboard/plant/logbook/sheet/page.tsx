'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getEquipmentDetail } from '@/app/lib/api/plant';
import { currentPeriod } from '@/app/lib/format';
import { urlString, useUrlState } from '@/app/lib/use-url-state';
import { confirmDialog } from '@/app/ui/dialogs';
import PageHeader from '@/app/ui/page-header';
import LogbookSheet from '@/app/ui/plant/logbook-sheet';
import LogbookViews from '@/app/ui/plant/logbook-views';
import MonthSelect from '@/app/ui/plant/month-select';
import { EquipmentPicker, equipmentOption } from '@/app/ui/plant/pickers';
import type { SearchableOption } from '@/app/ui/async-select';

/**
 * The Vehicle Log Book and Diesel Report Sheet (2026-10-15): pick a machine and a month, read
 * and fill in its days in the client's layout, and download it as PDF or Excel.
 *
 * 036: the machine and month live in the URL (a machine's page links straight here, and Back
 * returns to the same sheet); the machine is a server-searched picker (code, name or registration
 * no.); the month is two selects, since `type="month"` is a text box in Safari and Firefox. K7:
 * switching machine or month with typed days asks first — it used to remount the sheet and throw
 * every typed day away.
 */
export default function LogbookSheetPage() {
  const [filters, setFilters] = useUrlState({
    equipmentId: urlString(),
    month: urlString(currentPeriod()),
  });
  const [unsaved, setUnsaved] = useState(0);
  const [selected, setSelected] = useState<SearchableOption | null>(null);
  // A machine arriving in the URL (from its own page, or Back) is named from its record.
  const linked = useQuery({
    queryKey: ['plant', 'equipment', filters.equipmentId],
    queryFn: () => getEquipmentDetail(filters.equipmentId),
    enabled: Boolean(filters.equipmentId) && selected?.id !== filters.equipmentId,
    select: equipmentOption,
  });

  async function change(patch: { equipmentId?: string; month?: string }) {
    if (
      unsaved > 0 &&
      !(await confirmDialog({
        title: 'Discard the days you typed?',
        message: `${unsaved} ${
          unsaved === 1 ? 'day has' : 'days have'
        } not been saved. Switching ${
          patch.month !== undefined ? 'month' : 'machine'
        } discards them.`,
        confirmLabel: 'Discard and switch',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      }))
    ) {
      return;
    }
    setUnsaved(0);
    setFilters(patch);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Logbook" />
        <LogbookViews current="sheet" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <EquipmentPicker
          id="sheet-machine"
          label="Machine"
          value={filters.equipmentId}
          selectedOption={
            selected?.id === filters.equipmentId ? selected : linked.data
          }
          onChange={(id, machine) => {
            if (machine) setSelected(equipmentOption(machine));
            void change({ equipmentId: id });
          }}
        />
        <MonthSelect
          id="sheet-month"
          label="Month"
          value={filters.month}
          onChange={(month) => void change({ month })}
        />
      </div>

      {filters.equipmentId ? (
        // Keyed so a different machine or month starts with nothing typed — reached only after
        // the confirm above, or with nothing to lose.
        <LogbookSheet
          key={`${filters.equipmentId}-${filters.month}`}
          equipmentId={filters.equipmentId}
          month={filters.month}
          onUnsavedChange={setUnsaved}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Pick a machine to see its month.
        </p>
      )}
    </div>
  );
}
