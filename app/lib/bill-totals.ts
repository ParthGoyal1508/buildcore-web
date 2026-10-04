/**
 * What gross, net, retention and recovery mean — in one place, pure (018 FR-002, T006–T008).
 *
 * ## Why this file exists at all
 *
 * The same arithmetic happens twice in this feature: live, as somebody types a quantity into the
 * sheet, and server-side, when the bill is composed. Two implementations of "net" is this feature's
 * worst available defect and it would **not announce itself** — the figures would simply differ
 * slightly on two screens, each one plausible, and the first person to notice would be a client.
 *
 * So the derivation lives here as pure functions (Principle I), mirroring
 * `buildcore-api/src/projects/billing/bill-totals.ts` function for function, and the sheet reads it
 * rather than computing in a component.
 *
 * ## A bill has four money figures and only two of them are "the amount"
 *
 * This is the distinction T007 asks be written down, and the reason it matters is one sentence long:
 * a reader who drills from the project summary's **cost** figure into a bill lands on a deduction
 * line, and without this would reasonably conclude the project spent it.
 *
 *   * **gross** — what the work came to. This is the project's revenue on a client bill and its
 *     subcontractor cost on an RA bill. It is the figure the P&L reads.
 *   * **retention** — money withheld against future obligations. On a client bill it is the
 *     *client's* money held back from us; on an RA bill it is *our* money held back from them.
 *     Either way it is a timing difference, **not** a cost and **not** a reduction in what was
 *     earned.
 *   * **advance recovery** — money already paid, coming back. Also **not a cost**: counting it
 *     would count the same rupee twice, once when the advance went out and once here.
 *   * **net** — what actually moves now. The only figure that answers "what is being paid", and the
 *     wrong figure for every question about what a project earned or spent.
 *
 * A summary that read `net` would understate every project by the retention held across it, and the
 * error grows with the project.
 */

/** Two decimal places, the rounding every money figure in this product uses. */
export const money = (value: number): number => Math.round(value * 100) / 100;

/** Three, matching the schema's quantity columns — a BOQ measures to the millimetre. */
export const quantity = (value: number): number =>
  Math.round(value * 1000) / 1000;

export interface BillLineInput {
  /** Measured on **this** bill. */
  quantity: number;
  rate: number;
  /** Measured on every earlier bill that has left draft. */
  previouslyBilledQty?: number;
  /** Contracted or awarded. `undefined` where there is no scope to measure against. */
  scopeQty?: number;
}

export interface BillLineTotals {
  amount: number;
  /** This bill and every earlier one. */
  cumulativeQty: number;
  /** Scope less cumulative. **Negative when over-measured** — reported, never clamped. */
  remainingQty: number;
  /**
   * True when the cumulative quantity has passed the scope.
   *
   * **A flag, not a refusal** (FR-003). Over-measurement is often correct — a site measures what is
   * there — and a measurement that cannot be entered is a measurement that goes in a notebook
   * instead. The refusal belongs at submit, and only for a flagged line with no reason.
   *
   * Any consumer summing billed values must know this can happen: a summary that quietly totals a
   * bill with an over-measured line is arithmetically right and materially misleading, which is why
   * the project summary carries `revenueIncludesOverScope` (T008).
   */
  exceedsScope: boolean;
}

/**
 * One line's amount and its position against the scope.
 *
 * `quotedPercentage` is the bidder's quoted excess as a fraction, applied here because the client's
 * BOQ is a **percentage BoQ**: one percentage quoted against the whole schedule rather than a rate
 * per line. A line priced from its rate alone is short by that percentage, on every line.
 *
 * **The grand total of a schedule is a different calculation** — see `scheduleTotals` below. There
 * the percentage goes on the total once, not on each line, because that is how the tender document
 * computes it and a per-line application rounds differently.
 */
export function lineTotals(
  line: BillLineInput,
  quotedPercentage = 0,
): BillLineTotals {
  const amount = money(line.quantity * line.rate * (1 + quotedPercentage));
  const cumulativeQty = quantity(
    (line.previouslyBilledQty ?? 0) + line.quantity,
  );
  const scope = line.scopeQty;
  return {
    amount,
    cumulativeQty,
    // Negative, not clamped: "you are 40 Cum over" is actionable and "0 remaining" is not.
    remainingQty: scope === undefined ? 0 : quantity(scope - cumulativeQty),
    exceedsScope: scope !== undefined && cumulativeQty > scope,
  };
}

export interface BillDeductions {
  /** Withheld by the client (or by us, on an RA bill). Not a cost. */
  retention?: number;
  /** Money already advanced, coming back. Not a cost. */
  advanceRecovery?: number;
  other?: number;
}

export interface BillTotals {
  gross: number;
  retention: number;
  advanceRecovery: number;
  otherDeductions: number;
  deductionTotal: number;
  /** What moves now. Never the figure a P&L reads. */
  net: number;
  /**
   * The figure the project summary should take from this bill.
   *
   * Deliberately a named field rather than a comment telling somebody to use `gross`: the field is
   * what survives being copied into a component by a person in a hurry.
   */
  pnlAmount: number;
  /** True when any line measured past its scope. */
  exceedsScope: boolean;
}

/** A bill's totals, from its lines and its deductions. */
export function billTotals(
  lines: BillLineTotals[],
  deductions: BillDeductions = {},
): BillTotals {
  const gross = money(lines.reduce((total, line) => total + line.amount, 0));
  const retention = money(deductions.retention ?? 0);
  const advanceRecovery = money(deductions.advanceRecovery ?? 0);
  const otherDeductions = money(deductions.other ?? 0);
  const deductionTotal = money(retention + advanceRecovery + otherDeductions);
  return {
    gross,
    retention,
    advanceRecovery,
    otherDeductions,
    deductionTotal,
    // Floored at zero: deductions exceeding the gross means nothing is paid this period, not that
    // the subcontractor owes it back through this document.
    net: money(Math.max(0, gross - deductionTotal)),
    pnlAmount: gross,
    exceedsScope: lines.some((line) => line.exceedsScope),
  };
}

/** Retention on a gross figure, from a fraction. `0.05` is 5%. */
export function retentionOn(gross: number, fraction: number): number {
  return money(gross * fraction);
}

export interface ScheduleTotals {
  /** The schedule at its own rates. */
  estimatedTotal: number;
  /** That figure with the quoted percentage applied **once**. */
  quotedTotal: number;
}

/**
 * A schedule's two grand totals (T058).
 *
 * **The percentage goes on the total, once.** The client's own file carries both figures —
 * ₹2,99,61,506.78 becoming ₹3,06,98,559.85 at `Excess (+) 0.0246` — so this is checkable rather than
 * assumed. Applying the percentage per line and summing gives a figure close enough to pass a glance
 * and wrong by rounding, which is the worst available outcome for a tender document: nobody queries
 * it and it does not match.
 *
 * Headings are not passed in. A BOQ heading carries no quantity and no rate, and including it as a
 * zero line would be arithmetically harmless and conceptually wrong — a heading is not a measured
 * quantity of nothing.
 */
export function scheduleTotals(
  items: { scopeQty: number; rate: number }[],
  quotedPercentage = 0,
): ScheduleTotals {
  const estimated = items.reduce(
    (total, item) => total + item.scopeQty * item.rate,
    0,
  );
  return {
    estimatedTotal: money(estimated),
    quotedTotal: money(estimated * (1 + quotedPercentage)),
  };
}

/**
 * A percentage for display, from the fraction the API carries.
 *
 * Three decimal places on the percentage, because the schema holds six on the fraction and the
 * client's own figure is `0.0246` — rendering that as "2%" loses the thing the column is for.
 */
export function percentLabel(fraction: number): string {
  const percent = fraction * 100;
  const fixed = percent.toFixed(3).replace(/\.?0+$/, '');
  return `${fixed === '' || fixed === '-' ? '0' : fixed}%`;
}
