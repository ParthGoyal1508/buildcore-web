'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  DWR_WEATHERS,
  FULL_DAY,
  type DwrLineInput,
  type DwrWarning,
  createDwr,
  previewMeasuredQuantity,
} from '@/app/lib/api/dwr';
import { getBOQ } from '@/app/lib/api/projects';
import { ROUTES } from '@/app/lib/constants';
import { todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';

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

export default function DwrForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [workDate, setWorkDate] = useState(todayIso());
  const [weather, setWeather] = useState('');
  const [workerCount, setWorkerCount] = useState('');
  const [machineryCount, setMachineryCount] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<DwrWarning[]>([]);

  const { data: boqGroups } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => getBOQ(projectId),
  });

  // Flattened to a single picker. A grouped select would mirror the BOQ tree, which is the right
  // shape for reading a schedule and the wrong one for finding one line fast on a phone at the end
  // of a shift.
  const boqOptions = (boqGroups ?? []).flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: `${item.boqNo} — ${item.taskName} (${item.unit})`,
    })),
  );

  const save = useMutation({
    mutationFn: (input: Parameters<typeof createDwr>[1]) =>
      createDwr(projectId, input),
    onSuccess: (report) => {
      // 022 reports three things rather than refusing them: a work date before the project started,
      // a second report for a day already covered, and a line past its BOQ scope. Shown, because a
      // 201 that quietly carried a warning is a 201 nobody reads.
      if (report.warnings.length > 0) {
        setWarnings(report.warnings);
        return;
      }
      router.push(ROUTES.projectsDwr(projectId));
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
      ...(weather ? { weather } : {}),
      ...(workerCount ? { workerCount: Number(workerCount) } : {}),
      ...(machineryCount ? { machineryCount: Number(machineryCount) } : {}),
      ...(description ? { description } : {}),
      ...(payload.length > 0 ? { lines: payload } : {}),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">Record a day</h2>
        <p className="text-sm text-gray-600">
          Enter what the site did. <strong>Quantities are computed</strong> — a
          measured line from its dimensions, a presence-paid line from the day
          served. There is no field to type one into.
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
            value={workDate}
            onChange={(event) => setWorkDate(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <span className="text-xs text-gray-500">
            The day being reported, not today.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Weather</span>
          <select
            value={weather}
            onChange={(event) => setWeather(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {DWR_WEATHERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

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
            weather, people and machines are worth recording on their own.
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
  boqOptions: { id: string; label: string }[];
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

      <label className="mb-3 flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">BOQ line</span>
        <select
          value={line.boqItemId}
          onChange={(event) =>
            onChange({ ...line, boqItemId: event.target.value })
          }
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">— not against a BOQ line —</option>
          {boqOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

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

function describe(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string };
  };
  if (anyErr?.status === 423) {
    return 'This project is locked, so nothing can be written to it. This is not a permission problem — the same person can write once it is unlocked.';
  }
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'The report was refused and the server gave no reason.'
  );
}
