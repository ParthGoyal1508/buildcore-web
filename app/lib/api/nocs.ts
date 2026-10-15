import { z } from 'zod';

import type { StoredFile } from '@/app/lib/api/client';
import { authFetch, authFetchFile } from '@/app/lib/session';

/** What a NOC can be uploaded against (2026-10-15). */
export type NocSubject =
  | 'work_order'
  | 'hire_order'
  | 'labour_worker'
  | 'vendor'
  | 'employee'
  | 'purchase_order';

const nocSchema = z.object({
  id: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  stage: z.string().nullable(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  issuedBy: z.string().nullable(),
  referenceNo: z.string().nullable(),
  issuedOn: z.string().nullable(),
  remarks: z.string().nullable(),
  createdAt: z.string(),
});
export type Noc = z.infer<typeof nocSchema>;

export async function getNocs(
  subjectType: NocSubject,
  subjectId: string,
): Promise<Noc[]> {
  const raw = await authFetch<unknown>(
    `/nocs?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`,
  );
  return z.array(nocSchema).parse(raw);
}

export interface NocInput {
  subjectType: NocSubject;
  subjectId: string;
  stage?: 'loi' | 'work_order';
  /** Base64, without the `data:` prefix. */
  file: string;
  fileName?: string;
  contentType?: string;
  issuedBy?: string;
  referenceNo?: string;
  issuedOn?: string;
  remarks?: string;
}

export async function uploadNoc(input: NocInput): Promise<Noc> {
  const raw = await authFetch<unknown>('/nocs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return nocSchema.parse(raw);
}

export async function getNocFile(id: string): Promise<StoredFile> {
  return authFetchFile(`/nocs/${id}/file`);
}

export async function deleteNoc(id: string): Promise<void> {
  await authFetch<void>(`/nocs/${id}`, { method: 'DELETE' });
}
