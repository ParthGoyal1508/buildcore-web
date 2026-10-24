import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * A company's branches — one per GST registration (041). Parth Realcon is registered in five
 * states and Tirupati Enterprises in seven; each registration has its own GSTIN, address and PF /
 * ESIC / PT codes, and exactly one is the head office.
 *
 * Managing them is a company setting (`/settings/companies/:id/branches`); choosing one on a
 * project, employee, letter or challan reads the picker list (`/settings/company-branches`), which
 * any signed-in user may for their own company and which carries no addresses or codes.
 */

/** The states and union territories the API knows the GST codes of (`gst-states.ts`). */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export const companyBranchSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  displayLabel: z.string(),
  label: z.string().nullable(),
  tradeName: z.string().nullable(),
  gstin: z.string().nullable(),
  stateCode: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pinCode: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  pfEstablishmentCode: z.string().nullable(),
  esicCode: z.string().nullable(),
  professionalTaxRegNumber: z.string().nullable(),
  isHeadOffice: z.boolean(),
  isActive: z.boolean(),
});
export type CompanyBranch = z.infer<typeof companyBranchSchema>;

export const branchOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  gstin: z.string().nullable(),
  state: z.string().nullable(),
  isHeadOffice: z.boolean(),
  isActive: z.boolean(),
});
export type BranchOption = z.infer<typeof branchOptionSchema>;

export type CompanyBranchInput = Partial<
  Pick<
    CompanyBranch,
    | 'label'
    | 'tradeName'
    | 'gstin'
    | 'address'
    | 'city'
    | 'state'
    | 'pinCode'
    | 'phone'
    | 'email'
    | 'website'
    | 'pfEstablishmentCode'
    | 'esicCode'
    | 'professionalTaxRegNumber'
    | 'isActive'
  >
>;

export async function listCompanyBranches(companyId: string): Promise<CompanyBranch[]> {
  return z
    .array(companyBranchSchema)
    .parse(await authFetch(`/settings/companies/${companyId}/branches`));
}

export async function createCompanyBranch(
  companyId: string,
  input: CompanyBranchInput,
): Promise<CompanyBranch> {
  return companyBranchSchema.parse(
    await authFetch(`/settings/companies/${companyId}/branches`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateCompanyBranch(
  companyId: string,
  branchId: string,
  input: CompanyBranchInput,
): Promise<CompanyBranch> {
  return companyBranchSchema.parse(
    await authFetch(`/settings/companies/${companyId}/branches/${branchId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function makeHeadOffice(
  companyId: string,
  branchId: string,
): Promise<CompanyBranch[]> {
  return z.array(companyBranchSchema).parse(
    await authFetch(`/settings/companies/${companyId}/branches/${branchId}/head-office`, {
      method: 'POST',
    }),
  );
}

/**
 * The branches a form can offer, head office first. `companyId` for a cross-company caller (the
 * API ignores it for anyone else); `includeInactive` for filters over history.
 */
export async function listBranchOptions(
  companyId?: string | null,
  includeInactive = false,
): Promise<BranchOption[]> {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  if (includeInactive) params.set('includeInactive', 'true');
  const query = params.toString();
  return z
    .array(branchOptionSchema)
    .parse(await authFetch(`/settings/company-branches${query ? `?${query}` : ''}`));
}

/** "Godhra (Gujarat) · 24AAMCP8659H1ZU" — how a branch reads in a select. */
export function branchOptionText(b: BranchOption): string {
  return [b.label, b.gstin].filter(Boolean).join(' · ') + (b.isHeadOffice ? ' — head office' : '');
}
