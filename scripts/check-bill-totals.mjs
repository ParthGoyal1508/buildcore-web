/**
 * Shared vectors for `app/lib/bill-totals.ts` (036 Wave 3, I5 mirror).
 *
 * A `.mjs` script (not `.ts`) so the app's `tsc` does not check it; Node strips the types of the
 * `.ts` module it imports. The web has no unit-test runner, and the screen's bill arithmetic must equal the API's
 * (`buildcore-api/src/projects/billing/bill-totals.ts`) figure for figure. The expected values
 * below were produced by the API's implementation; this script fails if the web's copy drifts.
 *
 *     node --experimental-strip-types scripts/check-bill-totals.mjs
 *
 * Pass the API file's path as the first argument to also check the API against the same vectors:
 *
 *     node --experimental-strip-types scripts/check-bill-totals.mjs ../buildcore-api/src/projects/billing/bill-totals.ts
 */
import * as web from '../app/lib/bill-totals.ts';

const VECTORS = [
  { label: 'money(1.005)', run: (m) => m.money(1.005), expected: 1.01 },
  { label: 'money(-1.005)', run: (m) => m.money(-1.005), expected: -1.01 },
  { label: 'money(2.675)', run: (m) => m.money(2.675), expected: 2.68 },
  { label: 'money(1e-7)', run: (m) => m.money(1e-7), expected: 0 },
  { label: 'money(123456789.125)', run: (m) => m.money(123456789.125), expected: 123456789.13 },
  { label: 'quantity(10.0005)', run: (m) => m.quantity(10.0005), expected: 10.001 },
  { label: 'unitRate(158.7953805)', run: (m) => m.unitRate(158.7953805), expected: 158.795381 },
  { label: 'roundHalfUp(0.125, 2)', run: (m) => m.roundHalfUp(0.125, 2), expected: 0.13 },
  { label: 'productRounded(2, 10.05, 0.5)', run: (m) => m.productRounded(2, 10.05, 0.5), expected: 5.03 },
  { label: 'retentionOn(5915.07, 0.05)', run: (m) => m.retentionOn(5915.07, 0.05), expected: 295.75 },
  { label: 'retentionOn(100.1, 0.05)', run: (m) => m.retentionOn(100.1, 0.05), expected: 5.01 },
  {
    label: 'lineTotals 37.25 × 178 at -10.79%',
    run: (m) => m.lineTotals({ quantity: 37.25, rate: 178 }, -0.1079).amount,
    expected: 5915.07,
  },
  {
    label: 'lineTotals 10.05 × 0.1',
    run: (m) => m.lineTotals({ quantity: 10.05, rate: 0.1 }).amount,
    expected: 1.01,
  },
  {
    label: 'lineTotals over scope',
    run: (m) =>
      m.lineTotals({ quantity: 5.5, rate: 100, previouslyBilledQty: 96.501, scopeQty: 100 }),
    expected: { amount: 550, cumulativeQty: 102.001, remainingQty: -2.001, exceedsScope: true },
  },
  {
    label: 'lineTotals 1.005 × 1 at +2.46%',
    run: (m) => m.lineTotals({ quantity: 1.005, rate: 1 }, 0.0246).amount,
    expected: 1.03,
  },
];

/**
 * Web-only (047): `scheduleTotals` has no API twin by that name — the API's `billableBoq` computes
 * the same figure — so these run against the web copy alone. NEWAI SHAHID SMARAK's shape: an
 * item-rate schedule at ₹4,88,000 beside a percentage schedule at ₹97,52,823 quoted −19.12%.
 */
const WEB_ONLY = [
  {
    label: 'scheduleTotals mixed item-rate + percentage at -19.12%',
    run: (m) =>
      m.scheduleTotals(
        [
          { scopeQty: 1, rate: 488000, takesQuotedPercentage: false },
          { scopeQty: 1, rate: 9752823, takesQuotedPercentage: true },
        ],
        -0.1912,
      ),
    expected: { estimatedTotal: 10240823, quotedTotal: 8376083.24 },
  },
  {
    label: 'scheduleTotals with no basis given still quotes every line',
    run: (m) => m.scheduleTotals([{ scopeQty: 2, rate: 100 }], 0.1).quotedTotal,
    expected: 220,
  },
];

function check(name, impl, vectors = VECTORS) {
  let failures = 0;
  for (const vector of vectors) {
    const actual = vector.run(impl);
    if (JSON.stringify(actual) !== JSON.stringify(vector.expected)) {
      failures++;
      console.error(
        `✗ ${name}: ${vector.label} → ${JSON.stringify(actual)}, expected ${JSON.stringify(vector.expected)}`,
      );
    }
  }
  console.log(`${name}: ${vectors.length - failures}/${vectors.length} vectors match`);
  return failures;
}

let failures = check('web', web) + check('web (047 schedule totals)', web, WEB_ONLY);
const apiPath = process.argv[2];
if (apiPath) {
  const api = await import(new URL(apiPath, `file://${process.cwd()}/`).href);
  failures += check('api', api);
}
process.exit(failures === 0 ? 0 : 1);
