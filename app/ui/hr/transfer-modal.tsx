'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { transferEmployee, type Employee } from '@/app/lib/api/hr-payroll';
import { listActiveCompanies } from '@/app/lib/api/settings';
import { todayIso } from '@/app/lib/format';
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
 * Transfer an employee to another company (005 US8).
 *
 * Two things are said plainly here rather than left to be discovered:
 *
 * - The employee gets a **new code** from the destination company's series unless
 *   retention is asked for. Somebody looking up the old code afterwards needs to
 *   know that happened.
 * - Attendance and payroll from before the transfer stay with the company the
 *   employee actually worked for. That is the whole point of the backend's
 *   transfer-aware row-level security, and it is the question an admin asks
 *   immediately after clicking this.
 */
export default function TransferModal({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [toCompanyId, setToCompanyId] = useState('');
  const [transferDate, setTransferDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [retainCode, setRetainCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ newCode?: string | null } | null>(null);

  const { data: companies } = useQuery({
    queryKey: ['companies', 'active'],
    queryFn: listActiveCompanies,
  });

  const transfer = useMutation({
    mutationFn: () =>
      transferEmployee(employee.id, {
        toCompanyId,
        transferDate,
        reason: reason.trim(),
        retainCode,
      }),
    onSuccess: (transferred) => {
      setResult(transferred);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', employee.id] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const canSubmit =
    toCompanyId &&
    toCompanyId !== employee.companyId &&
    transferDate &&
    reason.trim().length > 0;

  if (result) {
    return (
      <Modal
        title="Employee transferred"
        onClose={onClose}
        footer={
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-green-800">
            {employee.employeeCode} has been transferred.
            {result.newCode && result.newCode !== employee.employeeCode && (
              <>
                {' '}
                Their new code is <strong>{result.newCode}</strong>.
              </>
            )}
          </p>
          <p className="text-gray-600">
            Attendance, leave and payroll from before {transferDate} remain visible
            to the company they worked for at the time — they have not moved with
            the employee.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Transfer ${employee.employeeCode}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => transfer.mutate()}
            disabled={!canSubmit || transfer.isPending}
          >
            {transfer.isPending ? 'Transferring…' : 'Transfer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <SelectField
          id="transfer-company"
          label="Destination company"
          value={toCompanyId}
          onChange={(event) => setToCompanyId(event.target.value)}
        >
          <option value="">Select a company</option>
          {companies
            ?.filter((company) => company.id !== employee.companyId)
            .map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
        </SelectField>
        <TextField
          id="transfer-date"
          label="Transfer date"
          type="date"
          value={transferDate}
          onChange={(event) => setTransferDate(event.target.value)}
          hint="Records before this date stay with the current company."
        />
        <TextField
          id="transfer-reason"
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <CheckboxField
          id="transfer-retain-code"
          label="Keep the existing employee code"
          description="Otherwise a new code is allocated from the destination company's series."
          checked={retainCode}
          onChange={(event) => setRetainCode(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
