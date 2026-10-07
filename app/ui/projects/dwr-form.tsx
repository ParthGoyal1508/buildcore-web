'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  FULL_DAY,
  type Dwr,
  type DwrLine,
  type DwrLineInput,
  type DwrWarning,
  createDwr,
  describeDwrError as describe,
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
type DraftLine =
  | {
      kind: 'measured';
      boqItemId: string;
      // The server's own six (`create-dwr.dto.ts`), carrying the labels site staff read. `nos` and
      // `factor` were this form's own invention and, under `forbidNonWhitelisted`, a 400.
      nos1: string;
      nos2: string;
      length: string;
      breadth: string;
      depth: string;
      density: string;
      remark: string;
    }
  | {
      kind: 'presence';
      boqItemId: string;
      equipmentId: string;
      servedQty: string;
      remark: string;
    };

const emptyMeasured = (): DraftLine => ({
  kind: 'measured',
  boqItemId: '',
  nos1: '',
  nos2: '',
  length: '',
  breadth: '',
  depth: '',
  density: '',
  remark: '',
});

const emptyPresence = (): DraftLine => ({
  kind: 'presence',
  boqItemId: '',
  equipmentId: '',
  servedQty: '1.000',
  remark: '',
});

/** A stored line, back into the shape this form edits. */
function draftFrom(line: DwrLine): DraftLine {
  const text = (value: string | null | undefined) =>
    value == null || Number(value) === 1 ? '' : String(Number(value));

  return line.paymentMode === 'work_basis'
    ? {
        kind: 'measured',
        boqItemId: line.boqItemId ?? '',
        nos1: text(line.nos1),
        nos2: text(line.nos2),
        length: text(line.length),
        breadth: text(line.breadth),
        depth: text(line.depth),
        density: text(line.density),
        remark: line.remark ?? '',
      }
    : {
        kind: 'presence',
        boqItemId: line.boqItemId ?? '',
        equipmentId: line.equipmentId ?? '',
        servedQty: String(quantityOf(line) ?? '1.000'),
        remark: line.remark ?? '',
      };
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
    (report?.lines ?? []).map(draftFrom),
  );
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<DwrWarning[]>([]);

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
      group.items.map((item) => ({
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
      workDate: day,
      ...rest
    }: Parameters<typeof createDwr>[1]): Promise<{
      warnings: DwrWarning[];
    }> => {
      if (report) {
        await updateDwr(report.id, rest);
        // An edit answers with no warnings: the three 022 reports — a date before the project
        // started, a day already covered, a line past scope — are raised when the day is first
        // recorded, and the report is already on file by the time it is being corrected.
        return { warnings: [] };
      }
      return { warnings: (await createDwr(projectId, { workDate: day, ...rest })).warnings };
    },
    onSuccess: (saved) => {
      // 022 reports three things rather than refusing them: a work date before the project started,
      // a second report for a day already covered, and a line past its BOQ scope. Shown, because a
      // 201 that quietly carried a warning is a 201 nobody reads.
      if (saved.warnings.length > 0) {
        setWarnings(saved.warnings);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['dwr'] });
      router.push(
        report
          ? ROUTES.projectsDwrReport(projectId, report.id)
          : ROUTES.projectsDwr(projectId),
      );
    },
    onError: (err: unknown) => setError(describe(err)),
  });

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

    const payload: DwrLineInput[] = lines.map((line) =>
      line.kind === 'measured'
        ? {
            paymentMode: 'work_basis' as const,
            ...(line.boqItemId ? { boqItemId: line.boqItemId } : {}),
            ...numeric('nos1', line.nos1),
            ...numeric('nos2', line.nos2),
            ...numeric('length', line.length),
            ...numeric('breadth', line.breadth),
            ...numeric('depth', line.depth),
            ...numeric('density', line.density),
            ...(line.remark ? { remark: line.remark } : {}),
          }
        : {
            paymentMode: 'day_basis' as const,
            ...(line.boqItemId ? { boqItemId: line.boqItemId } : {}),
            ...(line.equipmentId ? { equipmentId: line.equipmentId } : {}),
            servedQty: line.servedQty,
            ...(line.remark ? { remark: line.remark } : {}),
          },
    );

    save.mutate({
      workDate,
      ...(workerCount ? { workerCount: Number(workerCount) } : {}),
      ...(machineryCount ? { machineryCount: Number(machineryCount) } : {}),
      ...(description ? { description } : {}),
      ...(payload.length > 0 ? { lines: payload } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">
          {editing ? `Correct ${report?.dprNumber}` : 'Record a day'}
        </h2>
        <p className="text-sm text-gray-600">
          Enter what the site did. <strong>Quantities are computed</strong> — a
          measured line from its dimensions, a presence-paid line from the day
          served. There is no field to type one into.
          {editing && (
            <>
              {' '}
              <strong>Saving replaces every line</strong> with what is below.
            </>
          )}
        </p>
      </header>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
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
              Add a measured line
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
            No lines. A day with nothing measured is still a day that happened —
            the people and the machines on site are worth recording on their own.
          </p>
        )}

        {lines.map((line, index) => (
          <LineEditor
            key={index}
            line={line}
            boqOptions={boqOptions}
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

      {shortDayWithoutRemark && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          A presence line below a full day needs a remark saying why. The real
          sheets argue the deduction there — &ldquo;1 operator, 1 helper not
          available at site&rdquo; — and a short day with no reason is a
          deduction nobody can defend.
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending || shortDayWithoutRemark}>
          {save.isPending ? 'Saving…' : 'Save the day'}
        </Button>
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
  onChange,
  onRemove,
}: {
  line: DraftLine;
  boqOptions: SearchableOption[];
  onChange: (next: DraftLine) => void;
  onRemove: () => void;
}) {
  const preview =
    line.kind === 'measured'
      ? previewMeasuredQuantity({
          nos1: line.nos1,
          nos2: line.nos2,
          length: line.length,
          breadth: line.breadth,
          depth: line.depth,
          density: line.density,
        })
      : null;

  return (
    <div className="rounded-md border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {line.kind === 'measured'
            ? 'Measured — quantity from dimensions'
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
          {boqOptions.length} lines in this schedule. Type any part of the number
          or the description — “shutter”, “91.05”, “cum”.
        </span>
      </div>

      {line.kind === 'measured' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ['nos1', 'Nos'],
                ['nos2', 'Factor'],
                ['length', 'Length'],
                ['breadth', 'Breadth'],
                ['depth', 'Depth'],
                ['density', 'Density'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{label}</span>
                <input
                  inputMode="decimal"
                  value={line[key]}
                  onChange={(event) =>
                    onChange({ ...line, [key]: event.target.value })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm">
            <span className="text-gray-600">
              The server will compute a quantity of{' '}
            </span>
            <span className="font-semibold text-gray-900">
              {preview ?? '—'}
            </span>
            {preview === null && (
              <span className="text-gray-600">
                {' '}
                — a factor of zero is refused rather than treated as a blank,
                because a line measuring nothing is usually a field left empty.
              </span>
            )}
            <span className="text-gray-600">
              . An empty box counts as one.
            </span>
          </p>
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

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">
          Remark{' '}
          {line.kind === 'presence' &&
            Number(line.servedQty) < FULL_DAY &&
            '(required for a short day)'}
        </span>
        <textarea
          rows={2}
          value={line.remark}
          onChange={(event) => onChange({ ...line, remark: event.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2"
          placeholder="30% deduction — shoulder slope, supervisor labour, staff not available"
        />
      </label>
    </div>
  );
}

/** Only the fields that carry a value, because an empty string is not a decimal. */
function numeric(key: string, value: string): Record<string, string> {
  return value.trim() === '' ? {} : { [key]: value.trim() };
}

