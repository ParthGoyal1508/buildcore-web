import { z } from 'zod';

import { VENDOR_TYPES } from '@/app/lib/constants';

/**
 * The vendor form's shape.
 *
 * Mirrors the DTO the backend validates, deliberately: GSTIN and PAN are checked
 * here against the same patterns so a typo is caught at the field rather than
 * returned as a 400 with no field attached. The backend remains the authority —
 * this only moves the first "no" closer to the person typing.
 *
 * Empty strings are normalised to `undefined` rather than sent. `gstin: ''` would
 * fail the backend's pattern, while omitting the key leaves the column null, which
 * is what an unfilled optional field means.
 */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/**
 * Trimmed and upper-cased (036 N2, 2026-10-17). GSTINs, PANs and IFSCs are printed in capitals
 * but typed in whatever case the keyboard was in, and the form used to refuse `27aapfu0939f1zv`
 * as "not a valid GSTIN" — a correct number, in the wrong case, which the form can fix itself.
 */
const optionalCode = optionalText.transform((v) => v?.toUpperCase());

/** Digits with the usual separators: `+91 98200 12345`, `022-2345 6789` (036 N2). */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const vendorFormSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required').max(200),
  type: z.enum(VENDOR_TYPES),
  gstin: optionalCode.refine((v) => v === undefined || GSTIN_PATTERN.test(v), {
    message: 'Not a valid 15-character GSTIN',
  }),
  pan: optionalCode.refine((v) => v === undefined || PAN_PATTERN.test(v), {
    message: 'Not a valid 10-character PAN',
  }),
  tdsSection: optionalText,
  tdsRate: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isNaN(n) ? undefined : n;
    })
    .refine((v) => v === undefined || (v >= 0 && v <= 100), {
      message: 'TDS rate must be between 0 and 100',
    }),
  active: z.boolean(),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  pinCode: optionalText.refine((v) => v === undefined || /^[0-9]{6}$/.test(v), {
    message: 'PIN code must be 6 digits',
  }),
  // Where the company pays this vendor — printed on the payment advice (2026-10-13).
  bankName: optionalText,
  bankBranch: optionalText,
  bankAccountNumber: optionalText.refine(
    (v) => v === undefined || /^[0-9A-Za-z]{6,34}$/.test(v),
    { message: 'Account number must be 6 to 34 letters or digits' },
  ),
  bankAccountHolderName: optionalText,
  ifscCode: optionalCode.refine(
    (v) => v === undefined || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v),
    { message: 'IFSC looks like BARB0DEOLIX — four letters, a zero, six characters' },
  ),
  categoryIds: z.array(z.string()),
  contacts: z.array(
    z.object({
      name: z.string().trim().min(1, 'Contact name is required'),
      phone: optionalText.refine(
        (v) => v === undefined || (v.length <= 20 && PHONE_PATTERN.test(v)),
        { message: 'Not a valid phone number' },
      ),
      email: optionalText.refine(
        (v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
        { message: 'Not a valid email address' },
      ),
    }),
  ),
})
  // A GSTIN embeds the holder's PAN as characters 3–12, so when both are given and disagree
  // one of them is a typo — usually caught only when a TDS return bounces (036 N2).
  .superRefine((values, ctx) => {
    if (values.gstin && values.pan && values.gstin.slice(2, 12) !== values.pan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pan'],
        message: `Doesn't match the GSTIN, whose PAN is ${values.gstin.slice(2, 12)}`,
      });
    }
  });

export type VendorFormValues = z.input<typeof vendorFormSchema>;
export type VendorFormOutput = z.output<typeof vendorFormSchema>;
