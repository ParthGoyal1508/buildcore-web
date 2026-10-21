'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import { getMyDocuments, getMyProfile } from '@/app/lib/api/my-workspace';
import { dateLabel } from '@/app/lib/format';
import { LoadingText } from '@/app/ui/spinner';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

const EXPIRY_CLASS: Record<string, string> = {
  expired: 'text-red-700',
  expiring_soon: 'text-amber-800',
};

/**
 * The employee's own record and documents (2026-10-16, My Workspace).
 *
 * Read-only: corrections go through HR, who keep the record. Sensitive numbers (Aadhaar, PAN, bank
 * account, UAN) are shown masked, as the server sends them. Documents list what is on file, which
 * mandatory ones are still missing, and anything expired or close to it — the things an employee
 * is otherwise only told about when attendance is blocked.
 */
export default function MyProfile() {
  const profile = useQuery({
    queryKey: ['my', 'profile'],
    queryFn: getMyProfile,
  });
  const documents = useQuery({
    queryKey: ['my', 'documents'],
    queryFn: getMyDocuments,
  });

  if (profile.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (profile.isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Could not load your profile.
      </p>
    );
  }
  const p = profile.data;
  const address = [
    p.presentAddress,
    p.presentCity,
    p.presentState,
    p.presentPinCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      <Card title="Employment">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={[p.firstName, p.lastName].filter(Boolean).join(' ')}
          />
          <Field label="Employee code" value={p.employeeCode} />
          <Field label="Designation" value={p.designationName} />
          <Field label="Department" value={p.departmentName} />
          <Field label="Site" value={p.siteName} />
          <Field label="Reports to" value={p.reportingManagerName} />
          <Field
            label="Date of joining"
            value={dateLabel(p.dateOfJoining ?? null)}
          />
          <Field
            label="Employment type"
            value={p.employmentType?.replace(/_/g, ' ')}
          />
        </dl>
      </Card>
      <Card title="Contact">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Mobile" value={p.mobile} />
          <Field label="Email" value={p.email} />
          <Field label="Address" value={address} />
          <Field
            label="Emergency contact"
            value={[
              p.emergencyContactName,
              p.emergencyContactRelation && `(${p.emergencyContactRelation})`,
              p.emergencyContactPhone,
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </dl>
      </Card>
      <Card title="Bank and statutory">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank" value={p.bankName} />
          <Field label="Account number" value={p.bankAccountNumber} />
          <Field label="IFSC" value={p.ifscCode} />
          <Field label="UAN" value={p.uan} />
          <Field label="PAN" value={p.pan} />
          <Field label="Aadhaar" value={p.aadhaar} />
        </dl>
      </Card>

      <Card title="Documents">
        {documents.isPending ? (
          <p className="text-sm text-gray-500" role="status">
            <LoadingText />
          </p>
        ) : documents.isError ? (
          <p className="text-sm text-red-700" role="alert">
            Could not load your documents.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {documents.data.mandatoryHeld} of {documents.data.mandatoryTotal}{' '}
              required documents on file.
            </p>
            {documents.data.missingMandatory.length > 0 && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">Still needed — give these to HR:</p>
                <ul className="mt-1 list-disc pl-5">
                  {documents.data.missingMandatory.map((doc) => (
                    <li key={doc.id}>{doc.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {documents.data.documents.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {documents.data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="text-gray-900">
                      {doc.documentTypeName}
                      {doc.documentNumber && (
                        <span className="text-gray-500">
                          {' '}
                          · {doc.documentNumber}
                        </span>
                      )}
                    </span>
                    <span
                      className={clsx(
                        'text-xs',
                        (doc.expiryState && EXPIRY_CLASS[doc.expiryState]) ??
                          'text-gray-500',
                      )}
                    >
                      {doc.expiresAt
                        ? `${doc.expiryState === 'expired' ? 'Expired' : 'Expires'} ${dateLabel(doc.expiresAt)}`
                        : 'No expiry'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
      <p className="text-xs text-gray-500">
        Something wrong? HR keeps this record — ask them to correct it.
      </p>
    </div>
  );
}
