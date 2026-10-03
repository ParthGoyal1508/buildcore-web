'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  assignLocation,
  getLocationAssignments,
  listSites,
  type LocationAssignment,
} from '@/app/lib/api/hr-payroll';
import { LOCATION_ASSIGNMENT, MESSAGES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  CheckboxField,
  FormError,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Where one employee's punches are judged, and the history of that decision (020 FR-007 – FR-009,
 * FR-011).
 *
 * **Appends, never edits.** There is no control here to change an existing assignment, and that is
 * the design rather than an omission: a transfer six months ago has to stay explicable, and a
 * mutable current value cannot answer "where was this person supposed to be on the day of that
 * punch". The server enforces it too — the endpoint takes no id.
 *
 * The empty state is the normal state. On the day this ships no employee carries an individual
 * assignment, so a screen that treats absence as a problem marks the entire workforce as
 * misconfigured and teaches administrators to ignore it.
 */
export default function LocationAssignmentPanel({
  employeeId,
}: {
  employeeId: string;
}) {
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: assignments, isError } = useQuery({
    queryKey: ['hr', 'location-assignments', employeeId],
    queryFn: () => getLocationAssignments(employeeId),
  });

  const { data: sites } = useQuery({
    queryKey: ['hr', 'sites'],
    queryFn: listSites,
  });

  const siteName = (id: string | null) =>
    id === null
      ? LOCATION_ASSIGNMENT.mobile
      : sites?.find((site) => site.id === id)?.name ?? id;

  const save = useMutation({
    mutationFn: () =>
      assignLocation(employeeId, {
        // Sent only when it means something. A site id alongside `isMobile` would be a fence the
        // server is being told to ignore, which is a contradiction worth not sending at all.
        siteId: isMobile ? undefined : siteId,
        isMobile,
        effectiveFrom,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['hr', 'location-assignments', employeeId],
      });
      setReason('');
    },
    onError: (err: Error) => setError(err.message),
  });

  /**
   * The two refusals this form owns, checked before the request.
   *
   * Not because the server will not refuse them — it will, and the database has a check constraint
   * underneath that — but because both are about a form somebody is still filling in, and a round
   * trip to be told "choose a site" is a round trip that did not need to happen.
   */
  const validationError = (): string | null => {
    if (!isMobile && !siteId) return LOCATION_ASSIGNMENT.siteRequired;
    if (isMobile && reason.trim().length === 0) {
      return LOCATION_ASSIGNMENT.reasonRequiredForMobile;
    }
    if (!effectiveFrom) return LOCATION_ASSIGNMENT.effectiveFromRequired;
    return null;
  };

  const submit = () => {
    const problem = validationError();
    setError(problem);
    if (!problem) save.mutate();
  };

  const [current, ...earlier] = assignments ?? [];

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {LOCATION_ASSIGNMENT.heading}
      </h3>

      {isError ? (
        <FormError message={MESSAGES.loadFailed} />
      ) : current ? (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
          <p className="font-medium text-gray-900">
            {LOCATION_ASSIGNMENT.current}: {siteName(current.siteId)}
          </p>
          <AssignmentDetail assignment={current} />
        </div>
      ) : (
        /* FR-011. Grey, not amber: this is how every employee works today, and styling the normal
           case as a warning is how a screen trains people to dismiss its warnings. */
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {LOCATION_ASSIGNMENT.noAssignment}
        </p>
      )}

      {earlier.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-700">
            {LOCATION_ASSIGNMENT.history} ({earlier.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {earlier.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded-md border border-gray-200 px-3 py-2"
              >
                <p className="text-gray-900">{siteName(assignment.siteId)}</p>
                <AssignmentDetail assignment={assignment} />
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-4">
        <SelectField
          id="assignment-site"
          label="Site"
          value={siteId}
          disabled={isMobile}
          hint={isMobile ? LOCATION_ASSIGNMENT.mobileScope : undefined}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">Select a site</option>
          {(sites ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <CheckboxField
          id="assignment-mobile"
          label={LOCATION_ASSIGNMENT.mobile}
          // FR-014, on the control rather than in a help page: an administrator who thinks this
          // exempts somebody from the photo check will treat the first face refusal as a bug.
          description={LOCATION_ASSIGNMENT.mobileScope}
          checked={isMobile}
          onChange={(event) => setIsMobile(event.target.checked)}
        />

        <TextField
          id="assignment-from"
          type="date"
          label={LOCATION_ASSIGNMENT.effectiveFrom}
          hint={LOCATION_ASSIGNMENT.effectiveFromHint}
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />

        <TextField
          id="assignment-reason"
          label={LOCATION_ASSIGNMENT.reason}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint={isMobile ? LOCATION_ASSIGNMENT.reasonRequiredForMobile : undefined}
        />

        <FormError message={error} />

        <Button type="button" onClick={submit} disabled={save.isPending}>
          {save.isPending ? LOCATION_ASSIGNMENT.saving : LOCATION_ASSIGNMENT.assign}
        </Button>
      </div>
    </section>
  );
}

/** The three facts that make an assignment explicable a year later. */
function AssignmentDetail({ assignment }: { assignment: LocationAssignment }) {
  return (
    <p className="text-xs text-gray-500">
      {LOCATION_ASSIGNMENT.effectiveFrom} {dateLabel(assignment.effectiveFrom)}
      {assignment.reason ? ` · ${assignment.reason}` : ''}
    </p>
  );
}
