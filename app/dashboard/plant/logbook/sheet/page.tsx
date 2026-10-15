'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import LogbookSheet from '@/app/ui/plant/logbook-sheet';
import LogbookViews from '@/app/ui/plant/logbook-views';
import { usePlantEquipment } from '@/app/ui/plant/use-plant-refs';
import PageHeader from '@/app/ui/page-header';

/** This month as `YYYY-MM`, in the browser's own calendar. */
function thisMonth(): string {
  return new Date().toLocaleDateString('en-CA').slice(0, 7);
}

/**
 * The Vehicle Log Book and Diesel Report Sheet (2026-10-15): pick a machine and a month, read
 * and fill in its days in the client's layout, and download it as PDF or Excel.
 */
export default function LogbookSheetPage() {
  const equipment = usePlantEquipment();
  const searchParams = useSearchParams();
  // Seeded from the URL, as the entries list is, so a machine's page can link straight here.
  const [equipmentId, setEquipmentId] = useState(
    searchParams.get('equipmentId') ?? '',
  );
  const [month, setMonth] = useState(searchParams.get('month') ?? thisMonth());
  const [search, setSearch] = useState('');

  // The picker narrows by code, name or registration number — the vehicle number is what a
  // driver's sheet is filed under. The chosen machine stays listed whatever the search says.
  const needle = search.trim().toLowerCase();
  const machines = (equipment.data ?? []).filter(
    (row) =>
      row.id === equipmentId ||
      !needle ||
      [row.code, row.name, row.registrationNo ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Logbook" />
        <LogbookViews current="sheet" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_12rem]">
        <TextField
          id="sheet-machine-search"
          label="Find a machine"
          placeholder="Code, name or registration no."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          id="sheet-machine"
          label="Machine"
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
        >
          <option value="">
            {machines.length === 0 ? 'No machine matches' : 'Select a machine'}
          </option>
          {machines.map((row) => (
            <option key={row.id} value={row.id}>
              {row.registrationNo ? `${row.registrationNo} · ` : ''}
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="sheet-month"
          label="Month"
          type="month"
          required
          value={month}
          onChange={(event) => setMonth(event.target.value || thisMonth())}
        />
      </div>

      {equipmentId ? (
        // Keyed so a different machine or month starts with nothing typed.
        <LogbookSheet
          key={`${equipmentId}-${month}`}
          equipmentId={equipmentId}
          month={month}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Pick a machine to see its month.
        </p>
      )}
    </div>
  );
}
