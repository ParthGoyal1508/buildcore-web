'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { joinCandidate } from '@/app/lib/api/recruitment';
import { ROUTES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

export default function JoinModal({
  candidateId,
  candidateName,
  onClose,
  onJoined,
}: {
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [form, setForm] = useState({
    actualJoiningDate: '',
    dateOfBirth: '',
    gender: 'male',
    permanentAddress: '',
    emergencyContact: '',
    siteId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ employeeId: string; employeeCode: string; delayedJoining: boolean; delayedByDays: number } | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      joinCandidate(candidateId, {
        actualJoiningDate: form.actualJoiningDate,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        permanentAddress: form.permanentAddress,
        emergencyContact: form.emergencyContact,
        siteId: form.siteId || undefined,
      }),
    onSuccess: (r) => {
      setResult(r);
      onJoined();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not complete joining.'),
  });

  if (result) {
    return (
      <Modal title="Joining complete" onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-green-700">
            Employee created with code <strong>{result.employeeCode}</strong>.
          </p>
          {result.delayedJoining && (
            <p className="text-amber-800">Delayed joining by {result.delayedByDays} days.</p>
          )}
          <div className="flex gap-2">
            <Link href={ROUTES.recruitmentOnboarding(result.employeeId)}>
              <Button>Open onboarding</Button>
            </Link>
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </div>
      </Modal>
    );
  }

  const valid =
    form.actualJoiningDate && form.dateOfBirth && form.permanentAddress && form.emergencyContact;

  return (
    <Modal
      title={`Complete joining — ${candidateName}`}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? 'Joining…' : 'Complete Joining'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <TextField id="j-doj" label="Actual joining date" type="date" value={form.actualJoiningDate} onChange={(e) => set('actualJoiningDate', e.target.value)} />
        <TextField id="j-dob" label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        <SelectField id="j-gender" label="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </SelectField>
        <TextField id="j-site" label="Site id (optional)" value={form.siteId} onChange={(e) => set('siteId', e.target.value)} hint="Defaults to the requisition's site." />
        <div className="sm:col-span-2">
          <TextField id="j-addr" label="Permanent address" value={form.permanentAddress} onChange={(e) => set('permanentAddress', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <TextField id="j-emg" label="Emergency contact" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
