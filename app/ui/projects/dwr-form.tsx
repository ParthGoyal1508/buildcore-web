'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  FULL_DAY,
  type Dwr,
  type DwrLine,
  type DwrLineInput,
  type DwrWarning,
  addDwrAttachment,
  createDwr,
  describeDwrError as describe,
  parseChainage,
  previewMeasuredQuantity,
  quantityOf,
  updateDwr,
} from '@/app/lib/api/dwr';
import { getBOQ } from '@/app/lib/api/projects';
import { ROUTES } from '@/app/lib/constants';
import { todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import SearchableSelect, {
  type SearchableOption,
} from '@/app/ui/searchable-select';
import { TABLE } from '@/app/ui/table';

/**
 * The shared table look at the measurement grid's density (2026-10-15): eleven columns of inputs
 * copied off the client's sheet, where px-4 py-3 pushes the remark and files off the screen. `!`
 * because clsx does not drop TABLE's own padding.
 */
const DENSE_TH = clsx(TABLE.th, '!px-3 !py-2');
const DENSE_TD = clsx(TABLE.td, '!px-3 !py-2');

/**
 * Recording a day's work (024 Story 1, FR-002 to FR-004).
 *
 * ## There is no quantity field, and that is the design
 *
 * A measured line is entered as its **dimensions** — length, breadth, depth and three optional
 * factors — and the server multiplies them. A presence-paid line is entered as the **day served**.
 * Neither shape has a field for a computed quantity, which is a stronger guarantee than validating
 * one: `forbidNonWhitelisted` is on in the API, so a request carrying a quantity is a 400 rather
 * than a figure that was silently ignored.
 *
 * The form **shows** the product before saving (FR-003) using the same rule the server applies — an
 * omitted factor is 1 — so nobody has to save and find out. A factor of zero shows nothing rather
 * than zero, because the server refuses it by name: zero times anything is zero, and a line
 * measuring nothing is almost always a field left empty rather than work that did not happen.
 *
 * ## The two kinds of line are two forms
 *
 * Not one form with a mode switch. All six factors default to 1 and their product is 1 —
 * indistinguishable from one full day — so a presence line that could carry factors is a presence
 * line whose quantity is right by coincidence until somebody fills one in. 022 made the DTO two
 * shapes for exactly this, and a single form here would quietly undo it.
 */
/**
 * One measurement, at one position, under a BOQ item.
 *
 * **The client's own measurement sheet, column for column** (reported 2026-10-07). Chainage, Side,
 * Nos, Length, Width, Height, Qty, Remark — what site staff are reading off when they type this,
 * and what the printable form prints back.
 *
 * The field *names* are still the server's (`create-dwr.dto.ts`): `nos1`, `breadth`, `depth`. Only
 * the labels change. `nos`/`factor` were this form's own invention once and, under
 * `forbidNonWhitelisted`, a 400 — a lesson worth not repeating.
 *
 * `nos2` and `density` are **deliberately absent**. They were offered as "Factor" and "Density"
 * and nothing has ever used them: of 27 recorded lines, none carries a value other than 1 for
 * either. Both default to 1, so the product is unchanged and the columns stay — the same decision
 * FR-023 made for weather. Qty is computed, never typed: a sheet where the dimensions and the
 * total can disagree is a sheet nobody can check.
 */
interface MeasurementRow {
  chainageFrom: string;
  chainageTo: string;
  roadSide: string;
  nos1: string;
  length: string;
  breadth: string;
  depth: string;
  remark: string;
  /**
   * The stored line this row is, when correcting a report (2026-10-12).
   *
   * Sent back on an edit so the line keeps its identity — and with it the files filed against it.
   * A line not sent back by id is deleted, and evidence cascades from the line it belongs to, so
   * this is what stops correcting a chainage from deleting the photograph of it.
   */
  id?: string;
  /**
   * Files picked for this measurement and **not yet uploaded**.
   *
   * They cannot be uploaded while they are being picked: a file is attached to a line, and on a
   * new report neither the report nor its lines exist until the day is saved. So they wait here
   * and go up once the save answers with the line ids — see `attachAll`.
   */
  files: File[];
}

/** The text fields of a measurement, which are what decide whether a row was filled in. */
const MEASUREMENT_FIELDS = [
  'chainageFrom',
  'chainageTo',
  'roadSide',
  'nos1',
  'length',
  'breadth',
  'depth',
  'remark',
] as const satisfies readonly (keyof MeasurementRow)[];

/**
 * The BOQ item is chosen **once** and measured as many times as the day needs.
 *
 * ## Why this is a group rather than a line
 *
 * One BOQ item is measured at many positions in a day. The client's own sheet shows nine rows of
 * pot-hole filling under item 1.1 — nine chainages, nine sides, nine quantities, one item. This
 * form made each of those a card with its own picker, so recording that day meant finding 1.1 in a
 * 120-line searchable list nine times. The schedule is the slow part of the entry and it was being
 * repeated for every measurement.
 *
 * **Nothing changes in the database.** `DWRTask` is already one row per measurement carrying its
 * own `boqItemId`, so a group of five rows is five tasks exactly as five cards were — the grouping
 * is this form's shape, not a new structure. Which is why there is no migration here and why a
 * report recorded before this edits perfectly: `draftsFrom` reads the stored rows back into groups.
 */
type DraftLine =
  | {
      kind: 'measured';
      boqItemId: string;
      rows: MeasurementRow[];
    }
  | {
      kind: 'presence';
      boqItemId: string;
      equipmentId: string;
      servedQty: string;
      remark: string;
      /** See {@link MeasurementRow.id}. A presence card is one line, so it carries one. */
      id?: string;
      files: File[];
    };

const emptyRow = (): MeasurementRow => ({
  chainageFrom: '',
  chainageTo: '',
  roadSide: '',
  nos1: '',
  length: '',
  breadth: '',
  depth: '',
  remark: '',
  files: [],
});

/** A new item opens with one row, because an item measured nowhere is not an entry anybody wants. */
const emptyMeasured = (): DraftLine => ({
  kind: 'measured',
  boqItemId: '',
  rows: [emptyRow()],
});

const emptyPresence = (): DraftLine => ({
  kind: 'presence',
  boqItemId: '',
  equipmentId: '',
  servedQty: '1.000',
  remark: '',
  files: [],
});

/**
 * `21.3` → `21+300`, for an edit.
 *
 * The reverse of `parseChainage`. Three digits of metres always: `6+820` and `6+082` are 738
 * metres apart, and dropping a leading zero on the second prints the first.
 */
function chainageText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const km = Number(value);
  if (Number.isNaN(km)) return '';
  const metres = Math.round(Math.abs(km) * 1000);
  return `${km < 0 ? '-' : ''}${Math.floor(metres / 1000)}+${String(
    metres % 1000,
  ).padStart(3, '0')}`;
}

/**
 * The stored lines, back into the groups this form edits.
 *
 * **Measured lines are grouped by BOQ item**, in the order the items first appear, so a day
 * recorded as nine measurements of item 1.1 edits as one item with nine rows — which is what it
 * was. Grouping by id rather than by adjacency on purpose: the stored order is the order they were
 * sent, and two runs of the same item separated by another would otherwise open as two groups of
 * the same thing, which is the duplication this change exists to remove.
 *
 * Lines with no BOQ item group together under "not against a BOQ line". They are genuinely one
 * group — the thing they have in common is having no item — and each keeps its own remark, which
 * is where a freeform measurement says what it was.
 *
 * Presence lines stay one card each. They carry no dimensions, so there is nothing to tabulate.
 */
function draftsFrom(lines: DwrLine[]): DraftLine[] {
  const text = (value: string | null | undefined) =>
    value == null || Number(value) === 1 ? '' : String(Number(value));

  const drafts: DraftLine[] = [];
  const groups = new Map<string, Extract<DraftLine, { kind: 'measured' }>>();

  for (const line of lines) {
    if (line.paymentMode !== 'work_basis') {
      drafts.push({
        kind: 'presence',
        boqItemId: line.boqItemId ?? '',
        equipmentId: line.equipmentId ?? '',
        servedQty: String(quantityOf(line) ?? '1.000'),
        remark: line.remark ?? '',
        id: line.id,
        files: [],
      });
      continue;
    }

    const key = line.boqItemId ?? '';
    let group = groups.get(key);
    if (!group) {
      group = { kind: 'measured', boqItemId: key, rows: [] };
      groups.set(key, group);
      drafts.push(group);
    }
    group.rows.push({
      // Back in the notation it was typed in, so an edit does not silently restate `21+300` as
      // `21.3` and leave the next reader comparing two spellings of one position.
      chainageFrom: chainageText(line.chainageFrom),
      chainageTo: chainageText(line.chainageTo),
      roadSide: line.roadSide ?? '',
      nos1: text(line.nos1),
      length: text(line.length),
      breadth: text(line.breadth),
      depth: text(line.depth),
      remark: line.remark ?? '',
      // Carried so the stored line survives the edit with its evidence attached.
      id: line.id,
      files: [],
    });
  }

  return drafts;
}

/**
 * Recording a day, and correcting one (022 FR-018, 024 FR-002).
 *
 * **One form for both.** Pass `report` and it edits that draft instead of creating a report; pass
 * nothing and it creates. A separate edit form would be a second place for the factor mapping to
 * drift, and that mapping has already been wrong once — `nos`/`factor` against a server that has
 * only ever accepted `nos1`/`nos2`.
 *
 * **The work date is not editable.** `UpdateDwrDto` omits it deliberately, and this says why rather
 * than silently disabling the field: a report is the record of one named day, so moving its date
 * makes it the record of a different day under a number people have already filed it under. The
 * remedy is to delete the draft and record the right day.
 */
export default function DwrForm({
  projectId,
  report,
}: {
  projectId: string;
  report?: Dwr;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = Boolean(report);

  const [workDate, setWorkDate] = useState(
    report?.workDate?.slice(0, 10) ?? todayIso(),
  );
  const [workerCount, setWorkerCount] = useState(
    report?.workerCount != null ? String(report.workerCount) : '',
  );
  const [machineryCount, setMachineryCount] = useState(
    report?.machineryCount != null ? String(report.machineryCount) : '',
  );
  const [description, setDescription] = useState(report?.description ?? '');
  const [lines, setLines] = useState<DraftLine[]>(
    draftsFrom(report?.lines ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<DwrWarning[]>([]);
  /** Files the day was saved without. Named rather than counted — the person knows which one. */
  const [unattached, setUnattached] = useState<string[]>([]);
  /** Set once the day is on file, so the form offers the report rather than a second save. */
  const [savedReportId, setSavedReportId] = useState<string | null>(null);

  /**
   * What is already filed against each stored line, so a correction shows it rather than looking
   * like nothing was ever attached. Names only — opening a file is the detail screen's job, and
   * this form is for what the day was.
   */
  const attached = new Map<string, string[]>();
  for (const file of report?.attachments ?? []) {
    if (!file.taskId) continue;
    attached.set(file.taskId, [
      ...(attached.get(file.taskId) ?? []),
      file.fileName,
    ]);
  }
  const attachedTo = (lineId: string | undefined) =>
    (lineId && attached.get(lineId)) || [];

  const { data: boqGroups } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => getBOQ(projectId),
  });

  // Flattened to a single picker. A grouped select would mirror the BOQ tree, which is the right
  // shape for reading a schedule and the wrong one for finding one line fast on a phone at the end
  // of a shift.
  //
  // Three fields rather than one joined string: the picker searches all of them and shows the
  // number apart from the description, which is what makes `91.05` and `91.06` tellable apart in a
  // list where both descriptions run to forty words.
  //
  // The contract schedule only (027). A project can carry an internal estimate as well, describing
  // the same work in the same words, and the two were listed together — every item twice, with
  // nothing to tell them apart. Measuring against the costing twin moves a `doneQty` no bill draws
  // on and the alerts deliberately ignore, so the day's work would be recorded and then absent from
  // progress. The API refuses one by BOQ number; this keeps it off the list that offers it.
  const boqOptions: SearchableOption[] = (boqGroups ?? [])
    .filter((group) => !group.isEstimate)
    .flatMap((group) =>
      // A non-BOQ item is measured on the bill that adds it; the API refuses it here.
      group.items
        .filter((item) => !item.nonBoq)
        .map((item) => ({
          id: item.id,
          label: item.boqNo,
          sublabel: item.taskName,
          note: item.unit,
        })),
    );

  const save = useMutation({
    // The work date is split off rather than conditionally built into the payload: `UpdateDwrDto`
    // does not accept it and the global pipe refuses an unknown field outright, so sending it on an
    // edit is a 400 rather than a value quietly ignored.
    mutationFn: async ({
      input: { workDate: day, ...rest },
      pending,
    }: {
      input: Parameters<typeof createDwr>[1];
      /** Files picked against each line, by that line's position in `input.lines`. */
      pending: File[][];
    }): Promise<{
      dwrId: string;
      warnings: DwrWarning[];
      /** Files the save went through for and the upload did not. Never silently dropped. */
      unattached: string[];
    }> => {
      const saved = report
        ? await updateDwr(report.id, rest)
        : await createDwr(projectId, { workDate: day, ...rest });
      const dwrId = report ? report.id : saved.id;

      // **After the save, never before.** A file belongs to a line and a line has no id until the
      // day is on file, so this is the first moment the two can be put together.
      const unattached = await attachAll(dwrId, saved.lineIds, pending);

      // An edit answers with no warnings: the three 022 reports — a date before the project
      // started, a day already covered, a line past scope — are raised when the day is first
      // recorded, and the report is already on file by the time it is being corrected.
      return { dwrId, warnings: report ? [] : saved.warnings, unattached };
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['dwr'] });
      // The day is on file from here on, whatever else is reported below. Remembering that turns
      // the save button into a way onward, because pressing Save twice on a new report files the
      // day twice.
      setSavedReportId(saved.dwrId);
      setUnattached(saved.unattached);
      // 022 reports three things rather than refusing them: a work date before the project started,
      // a second report for a day already covered, and a line past its BOQ scope. Shown, because a
      // 201 that quietly carried a warning is a 201 nobody reads.
      setWarnings(saved.warnings);
      if (saved.warnings.length > 0 || saved.unattached.length > 0) return;
      router.push(
        report
          ? ROUTES.projectsDwrReport(projectId, saved.dwrId)
          : ROUTES.projectsDwr(projectId),
      );
    },
    onError: (err: unknown) => setError(describe(err)),
  });

  /**
   * A file picked beside a row that measures nothing.
   *
   * An empty row is dropped rather than sent — adding one and not filling it is ordinary, and a nil
   * line on a measurement sheet is a line a reviewer has to ask about. But dropping a row that has
   * a photograph on it would discard the photograph silently, so this is said out loud instead. The
   * file is not what makes a row a measurement: every factor defaults to 1, so a row with nothing
   * in it would be saved as a quantity of 1 that nobody entered.
   */
  const fileWithoutMeasurement = lines.some(
    (line) =>
      line.kind === 'measured' &&
      line.rows.some((row) => !hasAnything(row) && row.files.length > 0),
  );

  /** FR-004. A short day needs a remark, and the form says so before the server has to. */
  const shortDayWithoutRemark = lines.some(
    (line) =>
      line.kind === 'presence' &&
      line.servedQty.trim() !== '' &&
      Number(line.servedQty) < FULL_DAY &&
      line.remark.trim() === '',
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setWarnings([]);

    // **One task per measurement row, carrying its group's BOQ item.** The grouping is this
    // form's shape; the wire has always been flat, so a group of nine rows sends the nine lines
    // nine cards used to.
    //
    // A row left entirely blank is dropped rather than sent. Adding a row and then not filling it
    // is ordinary — somebody clicks twice, or measures eight of the nine they expected — and a
    // nil line on a bill's measurement sheet is a line a reviewer has to ask about.
    //
    // Each entry carries the files picked beside it, so `pending[n]` is what belongs to
    // `payload[n]` — and the save answers with a line id per position, which is how a photograph
    // reaches the measurement it is evidence of rather than the one next to it.
    const entries: { line: DwrLineInput; files: File[] }[] = lines.flatMap(
      (line): { line: DwrLineInput; files: File[] }[] =>
        line.kind === 'measured'
          ? line.rows.filter(hasAnything).map((row) => ({
              files: row.files,
              line: {
                paymentMode: 'work_basis' as const,
                ...(row.id ? { id: row.id } : {}),
                ...(line.boqItemId ? { boqItemId: line.boqItemId } : {}),
                ...numeric('nos1', row.nos1),
                ...numeric('length', row.length),
                ...numeric('breadth', row.breadth),
                ...numeric('depth', row.depth),
                // Converted here, not validated away: the API's `chainageFrom` is `@IsNumberString`,
                // so `21+300` would be a 400. `parseChainage` returns null for anything it cannot
                // read, and a null is simply not sent — the alternative is sending a guess.
                ...chainage('chainageFrom', row.chainageFrom),
                ...chainage('chainageTo', row.chainageTo),
                ...(row.roadSide.trim()
                  ? { roadSide: row.roadSide.trim() }
                  : {}),
                ...(row.remark ? { remark: row.remark } : {}),
              },
            }))
          : [
              {
                files: line.files,
                line: {
                  paymentMode: 'day_basis' as const,
                  ...(line.id ? { id: line.id } : {}),
                  ...(line.boqItemId ? { boqItemId: line.boqItemId } : {}),
                  ...(line.equipmentId
                    ? { equipmentId: line.equipmentId }
                    : {}),
                  servedQty: line.servedQty,
                  ...(line.remark ? { remark: line.remark } : {}),
                },
              },
            ],
    );
    const payload = entries.map((entry) => entry.line);

    save.mutate({
      input: {
        workDate,
        ...(workerCount ? { workerCount: Number(workerCount) } : {}),
        ...(machineryCount ? { machineryCount: Number(machineryCount) } : {}),
        ...(description ? { description } : {}),
        ...(payload.length > 0 ? { lines: payload } : {}),
      },
      pending: entries.map((entry) => entry.files),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? `Correct ${report?.dprNumber}` : 'Record a day'}
        </h2>
        <p className="text-sm text-gray-600">
          Enter what the site did. Choose a BOQ item once and measure it as many
          times as the day needs — a row per position, as the sheet is written.{' '}
          <strong>Quantities are computed</strong>: a measurement from its
          dimensions, a presence-paid line from the day served. There is no
          field to type one into. Files are optional on every line, and they go
          up when the day is saved.
          {editing && (
            <>
              {' '}
              <strong>Saving replaces every line</strong> with what is below.
            </>
          )}
        </p>
      </header>

      {error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {warnings.length > 0 && (
        <div
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          <p className="font-medium">
            Saved, and there are things worth knowing:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
          <Button
            type="button"
            className="mt-2"
            onClick={() => router.push(ROUTES.projectsDwr(projectId))}
          >
            Back to the list
          </Button>
        </div>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Work date</span>
          <input
            type="date"
            required
            disabled={editing}
            value={workDate}
            onChange={(event) => setWorkDate(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <span className="text-xs text-gray-500">
            {editing
              ? 'A report is the record of one named day, so its date cannot move. Delete this draft and record the right day instead.'
              : 'The day being reported, not today.'}
          </span>
        </label>

        {/*
          **Weather was here and is deliberately gone** (028 FR-023). Removed from entry at the
          client's request: a field nobody filled in honestly and nobody read.

          The column, its default and every recorded value are kept on the server — removing the
          input is what was asked, discarding history is not — and the printable form still prints
          what a report holds. The API no longer accepts the field at all, and its pipe runs at
          `forbidNonWhitelisted`, so sending it from here would now be a 400 rather than a value
          quietly ignored.
        */}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">People on site</span>
          <input
            type="number"
            min={0}
            value={workerCount}
            onChange={(event) => setWorkerCount(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Machines on site</span>
          <input
            type="number"
            min={0}
            value={machineryCount}
            onChange={(event) => setMachineryCount(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">What happened</span>
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-gray-900">Lines</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setLines((rows) => [...rows, emptyMeasured()])}
            >
              Add a BOQ item
            </Button>
            <Button
              type="button"
              onClick={() => setLines((rows) => [...rows, emptyPresence()])}
            >
              Add a presence line
            </Button>
          </div>
        </div>

        {lines.length === 0 && (
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            Nothing recorded yet. A day with nothing measured is still a day
            that happened — the people and the machines on site are worth
            recording on their own.
          </p>
        )}

        {lines.map((line, index) => (
          <LineEditor
            key={index}
            line={line}
            boqOptions={boqOptions}
            attachedTo={attachedTo}
            onChange={(next) =>
              setLines((rows) =>
                rows.map((row, i) => (i === index ? next : row)),
              )
            }
            onRemove={() =>
              setLines((rows) => rows.filter((_row, i) => i !== index))
            }
          />
        ))}
      </section>

      {unattached.length > 0 && (
        <div
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <p className="font-medium">
            The day was saved, and{' '}
            {unattached.length === 1 ? 'one file' : 'these files'} did not
            attach:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {unattached.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="mt-1">
            Nothing else was lost. Open the report and attach{' '}
            {unattached.length === 1 ? 'it' : 'them'} there.
          </p>
        </div>
      )}

      {fileWithoutMeasurement && (
        <p
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          A file is attached to a measurement that has nothing measured on it. A
          row with every box empty is not saved, so the file would go with it —
          enter the measurement, or remove the file.
        </p>
      )}

      {shortDayWithoutRemark && (
        <p
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          A presence line below a full day needs a remark saying why. The real
          sheets argue the deduction there — &ldquo;1 operator, 1 helper not
          available at site&rdquo; — and a short day with no reason is a
          deduction nobody can defend.
        </p>
      )}

      <div className="flex gap-3">
        {/* Once the day is on file the primary action is the way onward, not a second save: this
            form creates a report, so pressing Save again files the day twice. */}
        {savedReportId ? (
          <Button
            type="button"
            onClick={() =>
              router.push(ROUTES.projectsDwrReport(projectId, savedReportId))
            }
          >
            Open the report
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={
              save.isPending || shortDayWithoutRemark || fileWithoutMeasurement
            }
          >
            {save.isPending ? 'Saving…' : 'Save the day'}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => router.push(ROUTES.projectsDwr(projectId))}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function LineEditor({
  line,
  boqOptions,
  attachedTo,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  boqOptions: SearchableOption[];
  /** File names already filed against a stored line, by that line's id. Empty on a new report. */
  attachedTo: (lineId: string | undefined) => string[];
  onChange: (next: DraftLine) => void;
  onRemove: () => void;
}) {
  /**
   * The item's total across its rows, which the client's sheet carries per item.
   *
   * `null` where any row's product is — a factor of zero is refused by the server rather than
   * treated as a blank, and a total that quietly skipped such a row would disagree with what gets
   * saved. Computed from the same helper each row shows, so the parts and the total cannot differ.
   */
  const subtotal =
    line.kind === 'measured'
      ? line.rows.filter(hasAnything).reduce<number | null>((total, row) => {
          if (total === null) return null;
          const value = rowQuantity(row);
          return value === null ? null : total + Number(value);
        }, 0)
      : null;

  return (
    <div className="rounded-md border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {line.kind === 'measured'
            ? 'Measured — one BOQ item, measured where the work happened'
            : 'Presence — quantity is the day served'}
        </span>
        <Button type="button" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="mb-3 flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">BOQ line</span>
        <SearchableSelect
          value={line.boqItemId}
          onChange={(boqItemId) => onChange({ ...line, boqItemId })}
          options={boqOptions}
          emptyLabel="— not against a BOQ line —"
          placeholder="Search by item number, description or unit"
        />
        <span className="text-xs text-gray-500">
          {boqOptions.length} lines in this schedule. Type any part of the
          number or the description — “shutter”, “91.05”, “cum”.
        </span>
      </div>

      {line.kind === 'measured' ? (
        <>
          {/*
            **The item is chosen once; the measurements are a table under it.**

            The client's sheet shows nine rows of pot-hole filling under item 1.1 — nine chainages,
            nine sides, nine quantities, one item. This form used to make each of those a card with
            its own picker, so recording that day meant finding 1.1 in a 120-line list nine times.

            A table rather than nine stacked cards because a table is what the person is copying
            from, and because eight dimensions stacked vertically nine times is a page nobody can
            check a column of against their own sheet. It scrolls inside itself, so a long remark
            never widens the page around it.
          */}
          <div className={TABLE.wrap}>
            <table className={clsx(TABLE.table, 'w-full min-w-[56rem]')}>
              <thead className={TABLE.thead}>
                <tr>
                  <th className={DENSE_TH}>Chainage from</th>
                  <th className={DENSE_TH}>To</th>
                  <th className={DENSE_TH}>Side</th>
                  <th className={DENSE_TH}>Nos.</th>
                  <th className={DENSE_TH}>Length</th>
                  <th className={DENSE_TH}>Width</th>
                  <th className={DENSE_TH}>Height</th>
                  <th className={clsx(DENSE_TH, 'text-right')}>Qty</th>
                  <th className={DENSE_TH}>Remark</th>
                  <th className={DENSE_TH}>Files</th>
                  <th className={DENSE_TH} aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {line.rows.map((row, rowIndex) => {
                  const update = (next: Partial<MeasurementRow>) =>
                    onChange({
                      ...line,
                      rows: line.rows.map((existing, i) =>
                        i === rowIndex ? { ...existing, ...next } : existing,
                      ),
                    });
                  const quantity = hasAnything(row) ? rowQuantity(row) : null;

                  return (
                    <tr key={rowIndex} className={TABLE.row}>
                      <td className={DENSE_TD}>
                        <Cell
                          value={row.chainageFrom}
                          onChange={(chainageFrom) => update({ chainageFrom })}
                          placeholder="21+300"
                          width="w-28"
                          label="Chainage from"
                        />
                      </td>
                      <td className={DENSE_TD}>
                        <Cell
                          value={row.chainageTo}
                          onChange={(chainageTo) => update({ chainageTo })}
                          placeholder="21+450"
                          width="w-28"
                          label="Chainage to"
                        />
                      </td>
                      <td className={DENSE_TD}>
                        <Cell
                          value={row.roadSide}
                          onChange={(roadSide) => update({ roadSide })}
                          placeholder="LHS"
                          width="w-24"
                          label="Side"
                        />
                      </td>
                      {(
                        [
                          ['nos1', 'Nos'],
                          ['length', 'Length'],
                          ['breadth', 'Width'],
                          ['depth', 'Height'],
                        ] as const
                      ).map(([key, label]) => (
                        <td key={key} className={DENSE_TD}>
                          <Cell
                            value={row[key]}
                            onChange={(value) => update({ [key]: value })}
                            numeric
                            width="w-20"
                            label={label}
                          />
                        </td>
                      ))}
                      {/* Per row, and computed. The client's sheet carries this column and it is
                          the one a reviewer checks against their own — so it is shown as the row
                          is typed rather than after a save. */}
                      <td className={clsx(DENSE_TD, TABLE.numeric)}>
                        {quantity ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className={DENSE_TD}>
                        <Cell
                          value={row.remark}
                          onChange={(remark) => update({ remark })}
                          placeholder="RA-06"
                          width="w-40"
                          label="Remark"
                        />
                      </td>
                      {/* Optional, on every measurement. The photograph of a pour is evidence for
                          **this** chainage; filed under the report it joins a pile of twenty that
                          argues for nothing in particular. */}
                      <td className={clsx(DENSE_TD, '!align-top')}>
                        <LineFiles
                          files={row.files}
                          attached={attachedTo(row.id)}
                          onChange={(files) => update({ files })}
                        />
                      </td>
                      <td className={clsx(DENSE_TD, 'text-right')}>
                        {/* Never the last row: removing it would leave an item measured nowhere,
                            and the way to drop an item is to remove the item. */}
                        {line.rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onChange({
                                ...line,
                                rows: line.rows.filter(
                                  (_row, i) => i !== rowIndex,
                                ),
                              })
                            }
                            className="min-h-11 px-2 text-sm text-red-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                            aria-label={`Remove measurement ${rowIndex + 1}`}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className={TABLE.tfoot}>
                <tr>
                  <td
                    className={clsx(
                      DENSE_TD,
                      'text-xs font-normal text-gray-600',
                    )}
                    colSpan={7}
                  >
                    Chainage as the sheet writes it — <strong>21+300</strong> is
                    21 km and 300 m. A plain <strong>21.300</strong> is accepted
                    too. An empty box counts as one.
                  </td>
                  <td className={clsx(DENSE_TD, TABLE.numeric)}>
                    {subtotal === null ? '—' : subtotal.toFixed(3)}
                  </td>
                  <td
                    className={clsx(
                      DENSE_TD,
                      'text-xs font-normal text-gray-600',
                    )}
                    colSpan={3}
                  >
                    Total for this item
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3">
            <Button
              type="button"
              onClick={() =>
                onChange({ ...line, rows: [...line.rows, emptyRow()] })
              }
            >
              Add a measurement
            </Button>
          </div>

          {subtotal === null && line.rows.some(hasAnything) && (
            <p className="mt-2 text-sm text-amber-800" role="status">
              A row has a factor of zero. The server refuses that rather than
              treating it as a blank, because a line measuring nothing is almost
              always a field left empty by mistake.
            </p>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Day served</span>
            <input
              inputMode="decimal"
              value={line.servedQty}
              onChange={(event) =>
                onChange({ ...line, servedQty: event.target.value })
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <span className="text-xs text-gray-500">
              <strong>1 is one full day.</strong> 0.7 is a day the site was
              there for seven tenths of what was asked.
            </span>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Files (optional)</span>
            <LineFiles
              files={line.files}
              attached={attachedTo(line.id)}
              onChange={(files) => onChange({ ...line, files })}
            />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              Equipment id (optional)
            </span>
            <input
              value={line.equipmentId}
              onChange={(event) =>
                onChange({ ...line, equipmentId: event.target.value })
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <span className="text-xs text-gray-500">
              Links the day to a machine&rsquo;s logbook, which prints beneath
              the measurement sheet on a bill.
            </span>
          </label>
        </div>
      )}

      {/* Presence only. A measured item's remarks belong to its rows — the client's sheet writes
          one per measurement ("RA-06"), and a single box under nine rows cannot say which of them
          it is about. */}
      {line.kind === 'presence' && (
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">
            Remark{' '}
            {Number(line.servedQty) < FULL_DAY && '(required for a short day)'}
          </span>
          <textarea
            rows={2}
            value={line.remark}
            onChange={(event) =>
              onChange({ ...line, remark: event.target.value })
            }
            className="rounded-md border border-gray-300 px-3 py-2"
            placeholder="30% deduction — shoulder slope, supervisor labour, staff not available"
          />
        </label>
      )}
    </div>
  );
}

/**
 * One cell of the measurement table.
 *
 * A bare input rather than a labelled field: the column header is the label, which is what makes
 * nine rows readable where nine labelled stacks are not. The header is not announced to a screen
 * reader by proximity though, so **every** cell carries an `aria-label` naming its column —
 * otherwise each one is "edit text" and the table is unusable without sight of it.
 *
 * `label` is required, and it used to fall back to `placeholder`. That read plausibly and was
 * wrong: the four text cells pass only a placeholder, so a screen reader announced the chainage
 * boxes as "21+300" and "21+450", the side as "LHS" and the remark as "RA-06" — examples, not
 * names. The fallback is gone so the compiler asks for the column name instead of inventing one.
 */
function Cell({
  value,
  onChange,
  placeholder,
  numeric: isNumeric,
  width,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  numeric?: boolean;
  width: string;
  label: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={isNumeric ? 'decimal' : undefined}
      aria-label={label}
      className={`${width} min-h-11 rounded-md border border-gray-300 px-2 py-1.5 ${
        isNumeric ? 'tabular-nums' : ''
      }`}
    />
  );
}

/**
 * Uploads every picked file against the line it was picked beside, once the lines have ids.
 *
 * **Sequential, and it never throws.** The day is already on file by the time this runs, so a
 * failure here is not a failed save — it is a saved day missing a photograph, which is a different
 * thing to tell somebody. The names come back so the form can say which ones, rather than reporting
 * a count or, worse, nothing.
 *
 * A line with no id is the case where the server answered without saying which row is which — an
 * older API, or fewer ids than lines. The file is reported unattached rather than guessed at: one
 * position out files a photograph against a chainage it is not evidence of, which is worse than
 * not filing it at all.
 */
async function attachAll(
  dwrId: string,
  lineIds: string[],
  pending: File[][],
): Promise<string[]> {
  const unattached: string[] = [];
  for (const [index, files] of pending.entries()) {
    const taskId = lineIds[index];
    for (const file of files) {
      if (!taskId) {
        unattached.push(file.name);
        continue;
      }
      try {
        await addDwrAttachment(dwrId, file, taskId);
      } catch {
        unattached.push(file.name);
      }
    }
  }
  return unattached;
}

/**
 * The files for one line: what is already filed against it, what is waiting to go up, and the way
 * to add more.
 *
 * Optional, and that is the whole contract — a measurement with no photograph is an ordinary
 * measurement. What it is **for** is the argument that comes later: the site says 20 cubic metres
 * at 21+300, the client's engineer says fewer, and what settles it is the photograph taken at the
 * edge of the carriageway on the day.
 */
function LineFiles({
  files,
  attached,
  onChange,
}: {
  files: File[];
  /** Already on the server, when a report is being corrected. Names only — the detail screen opens them. */
  attached: string[];
  onChange: (next: File[]) => void;
}) {
  return (
    <div className="flex w-44 flex-col gap-1">
      {attached.map((name) => (
        <span
          key={name}
          title={`${name} — already attached`}
          className="truncate text-xs text-gray-500"
        >
          {name}
        </span>
      ))}
      {files.map((file, index) => (
        <span
          key={`${file.name}-${index}`}
          className="flex items-center gap-1 text-xs"
        >
          <span className="truncate" title={file.name}>
            {file.name}
          </span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onChange(files.filter((_f, i) => i !== index))}
            className="text-red-700 hover:underline"
          >
            &times;
          </button>
        </span>
      ))}
      {/* The input **covers the label** rather than being `sr-only`. A 1px absolutely-positioned
          input is a focus target the browser scrolls an ancestor to reveal, and in a table wider
          than the page that ancestor turned out to be the shell — which clips without a scrollbar,
          so the layout shifted and stayed shifted. Sized to the label it is already in view, and
          it is still a real focusable input named by the label; the ring is drawn on the label,
          which is the part anybody can see. */}
      <label className="relative cursor-pointer text-xs text-blue-600 hover:underline focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-500">
        + File
        <input
          type="file"
          multiple
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length > 0) onChange([...files, ...picked]);
            // Cleared so picking the same file twice in a row still fires a change.
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

/**
 * One row's quantity, by the same rule the server applies.
 *
 * `null` where a factor is zero — refused rather than treated as a blank, because a line measuring
 * nothing is almost always a field left empty by mistake rather than work that did not happen.
 */
function rowQuantity(row: MeasurementRow): string | null {
  return previewMeasuredQuantity({
    nos1: row.nos1,
    length: row.length,
    breadth: row.breadth,
    depth: row.depth,
  });
}

/**
 * Whether a measurement row carries anything at all.
 *
 * A row of empty boxes would otherwise be sent as a line measuring 1 — every factor omitted, so
 * the product is 1 — which is a quantity nobody entered appearing on a bill.
 */
function hasAnything(row: MeasurementRow): boolean {
  // The text fields by name, not `Object.values`: the row also carries an id and a list of picked
  // files, and a blanket `.trim()` over every value would both crash on those and count a row as
  // measured because a file was picked beside it. A file is evidence **for** a measurement; it is
  // not one, and a row sent with no dimensions is a quantity of 1 nobody entered.
  return MEASUREMENT_FIELDS.some((key) => row[key].trim() !== '');
}

/** Only the fields that carry a value, because an empty string is not a decimal. */
function numeric(key: string, value: string): Record<string, string> {
  return value.trim() === '' ? {} : { [key]: value.trim() };
}

/**
 * A chainage, in whichever notation it was typed, as the decimal kilometres the API stores.
 *
 * Omitted rather than sent when it cannot be read. The API validates these as number strings, so
 * `km 21` would come back a 400 naming a field the person cannot see the problem with — and a
 * position nobody could parse is better absent than approximated.
 */
function chainage(key: string, value: string): Record<string, string> {
  const parsed = parseChainage(value);
  return parsed === null ? {} : { [key]: parsed };
}
