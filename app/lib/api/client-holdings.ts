import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * Money a client paid against our bills, and what it is holding back (api 048).
 *
 * Amounts arrive as two-decimal strings and are read as numbers here — they are display figures,
 * and every sum that decides anything is the server's.
 */
const money = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)));

const receiptSchema = z.object({
  id: z.string(),
  receivedOn: z.string(),
  amount: money,
  retentionAmount: money,
  cpbgAmount: money,
  tdsAmount: money,
  otherDeduction: money,
  otherDeductionNote: z.string().nullable(),
  /** `amount` plus every deduction — how much of the bill this receipt settles. */
  settles: money,
  instrument: z.string(),
  reference: z.string().nullable(),
  remarks: z.string().nullable(),
  recordedAt: z.string(),
});
export type ClientReceipt = z.infer<typeof receiptSchema>;

const billReceiptsSchema = z.object({
  billId: z.string(),
  billNumber: z.string(),
  billValue: money,
  billValueBasis: z.enum(['package', 'certified', 'billed']),
  settled: money,
  outstanding: money,
  receipts: z.array(receiptSchema),
  suggested: z.object({ retentionAmount: money, cpbgAmount: money }),
  pbgRunning: z.boolean(),
});
export type ClientBillReceipts = z.infer<typeof billReceiptsSchema>;

const holdingsSchema = z.object({
  projectId: z.string(),
  received: money,
  receiptCount: z.number(),
  retention: z.object({ withheld: money, released: money, held: money }),
  cpbg: z.object({ deducted: money, refunded: money, held: money }),
  tds: money,
  otherDeductions: money,
  totalHeld: money,
  clientRetentionFraction: money.nullable(),
  clientCpbgFraction: money.nullable(),
  runningPbgs: z.array(
    z.object({
      id: z.string(),
      bgNumber: z.string().nullable(),
      amount: money,
      expiryDate: z.string().nullable(),
      issuingBank: z.string().nullable(),
    }),
  ),
  cpbgRefundDue: z.boolean(),
  releases: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['retention', 'cpbg']),
      amount: money,
      releasedOn: z.string(),
      reason: z.string(),
      bankGuaranteeId: z.string().nullable(),
      bgNumber: z.string().nullable(),
    }),
  ),
});
export type ClientHoldings = z.infer<typeof holdingsSchema>;

export const PAYMENT_INSTRUMENTS = [
  'bank_transfer',
  'cheque',
  'cash',
  'adjustment',
] as const;
export type PaymentInstrument = (typeof PAYMENT_INSTRUMENTS)[number];

export interface ClientReceiptInput {
  receivedOn: string;
  amount: number;
  retentionAmount?: number;
  cpbgAmount?: number;
  tdsAmount?: number;
  otherDeduction?: number;
  otherDeductionNote?: string;
  instrument: PaymentInstrument;
  reference?: string;
  remarks?: string;
}

export interface ClientHoldReleaseInput {
  kind: 'retention' | 'cpbg';
  amount: number;
  releasedOn: string;
  reason: string;
  bankGuaranteeId?: string;
}

export const clientHoldingKeys = {
  bill: (billId: string) => ['client-bills', billId, 'receipts'] as const,
  project: (projectId: string) =>
    ['projects', projectId, 'client-holdings'] as const,
};

export async function getBillReceipts(
  billId: string,
): Promise<ClientBillReceipts> {
  return billReceiptsSchema.parse(
    await authFetch<unknown>(`/projects/client-bills/${billId}/receipts`),
  );
}

export async function recordBillReceipt(
  billId: string,
  input: ClientReceiptInput,
): Promise<{ receipt: ClientReceipt; position: ClientBillReceipts }> {
  const raw = await authFetch<{ receipt: unknown; position: unknown }>(
    `/projects/client-bills/${billId}/receipts`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return {
    receipt: receiptSchema.parse(raw.receipt),
    position: billReceiptsSchema.parse(raw.position),
  };
}

export async function removeBillReceipt(
  billId: string,
  receiptId: string,
): Promise<ClientBillReceipts> {
  return billReceiptsSchema.parse(
    await authFetch<unknown>(
      `/projects/client-bills/${billId}/receipts/${receiptId}`,
      { method: 'DELETE' },
    ),
  );
}

export async function getClientHoldings(
  projectId: string,
): Promise<ClientHoldings> {
  return holdingsSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/client-holdings`),
  );
}

export async function recordClientHoldRelease(
  projectId: string,
  input: ClientHoldReleaseInput,
): Promise<ClientHoldings> {
  return holdingsSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/client-holdings/releases`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
