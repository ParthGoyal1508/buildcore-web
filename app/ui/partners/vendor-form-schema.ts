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

export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const vendorFormSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required').max(200),
  type: z.enum(VENDOR_TYPES),
  gstin: optionalText.refine((v) => v === undefined || GSTIN_PATTERN.test(v), {
    message: 'Not a valid 15-character GSTIN',
  }),
  pan: optionalText.refine((v) => v === undefined || PAN_PATTERN.test(v), {
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
  categoryIds: z.array(z.string()),
  contacts: z.array(
    z.object({
      name: z.string().trim().min(1, 'Contact name is required'),
      phone: optionalText,
      email: optionalText.refine(
        (v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
        { message: 'Not a valid email address' },
      ),
    }),
  ),
});

export type VendorFormValues = z.input<typeof vendorFormSchema>;
export type VendorFormOutput = z.output<typeof vendorFormSchema>;
