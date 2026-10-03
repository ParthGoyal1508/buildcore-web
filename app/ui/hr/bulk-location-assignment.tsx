'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  assignLocationToMany,
  listSites,
  type BulkAssignmentOutcome,
} from '@/app/lib/api/hr-payroll';
import { LOCATION_ASSIGNMENT } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Assigns one location to a site's staff in a single action (020 FR-010).
 *
 * The employees come from whatever the list is currently showing, filters and all. That is the
 * whole reason this lives beside the list rather than on a screen of its own: "a site's staff" is
 * already expressible there, and a second employee picker would be a second place for the two to
 * disagree about who counts.
 *
 * **Partial success is reported by name.** The API has no bulk route, so this is a loop of
 * single-employee calls, and "28 of 30 saved" tells an administrator that two people are wrong
 * without telling them which two — leaving them to check thirty records by hand, or far more
 * likely, to assume it was fine.
 */
export default function BulkLocationAssignment({
  employees,
  onClose,
}: {
  /** Exactly what the list is showing: the filter is the selection. */
  employees: { id: string; employeeCode: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const { data: sites } = useQuery({
    queryKey: ['hr', 'sites'],
    queryFn: listSites,
  });

  const codeOf = (employeeId: string) =>
    employees.find((employee) => employee.id === employeeId)?.employeeCode ??
    employeeId;

  const assign = useMutation({
    mutationFn: () =>
      assignLocationToMany(
        employees.map((employee) => employee.id),
        {
          siteId: isMobile ? undefined : siteId,
          isMobile,
          effectiveFrom,
          reason: reason.trim() || undefined,
        },
      ),
    onSuccess: (outcomes: BulkAssignmentOutcome[]) => {
      const failed = outcomes.filter((outcome) => outcome.error);
      const ok = outcomes.length - failed.length;
      setResult(
        failed.length === 0
          ? LOCATION_ASSIGNMENT.bulkDone(ok)
          : LOCATION_ASSIGNMENT.bulkPartial(
              ok,
              failed.map((outcome) => codeOf(outcome.employeeId)),
            ),
      );
      // Every per-employee panel is now stale. Invalidated by prefix rather than one key per
      // employee: this ran over a whole site, and enumerating the keys would mean maintaining a
      // second list of who was included.
      void queryClient.invalidateQueries({
        queryKey: ['hr', 'location-assignments'],
      });
    },
    onError: (err: Error) => setError(err.message),
  });

  const submit = () => {
    if (employees.length === 0) {
      setError(LOCATION_ASSIGNMENT.bulkNobodySelected);
      return;
    }
    if (!isMobile && !siteId) {
      setError(LOCATION_ASSIGNMENT.siteRequired);
      return;
    }
    if (isMobile && reason.trim().length === 0) {
      setError(LOCATION_ASSIGNMENT.reasonRequiredForMobile);
      return;
    }
    if (!effectiveFrom) {
      setError(LOCATION_ASSIGNMENT.effectiveFromRequired);
      return;
    }
    setError(null);
    assign.mutate();
  };

  return (
    <Modal
      title={LOCATION_ASSIGNMENT.bulkHeading}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </SecondaryButton>
          {/* Gone once it has run. Offering it again after a partial failure invites somebody to
              re-run the whole set to catch two stragglers, which appends a duplicate assignment
              for the twenty-eight that already succeeded. */}
          {!result && (
            <Button type="button" onClick={submit} disabled={assign.isPending}>
              {assign.isPending
                ? LOCATION_ASSIGNMENT.saving
                : LOCATION_ASSIGNMENT.assign}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          {LOCATION_ASSIGNMENT.bulkHint}
        </p>
        <p className="text-sm font-medium text-gray-900">
          {employees.length} employee{employees.length === 1 ? '' : 's'} in the
          current list
        </p>

        {result ? (
          <p role="status" className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {result}
          </p>
        ) : (
          <>
            <SelectField
              id="bulk-assignment-site"
              label="Site"
              value={siteId}
              disabled={isMobile}
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
              id="bulk-assignment-mobile"
              label={LOCATION_ASSIGNMENT.mobile}
              description={LOCATION_ASSIGNMENT.mobileScope}
              checked={isMobile}
              onChange={(event) => setIsMobile(event.target.checked)}
            />

            <TextField
              id="bulk-assignment-from"
              type="date"
              label={LOCATION_ASSIGNMENT.effectiveFrom}
              hint={LOCATION_ASSIGNMENT.effectiveFromHint}
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />

            <TextField
              id="bulk-assignment-reason"
              label={LOCATION_ASSIGNMENT.reason}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />

            <FormError message={error} />
          </>
        )}
      </div>
    </Modal>
  );
}
