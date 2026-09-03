'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  Client,
  ClientInput,
  createClient,
  updateClient,
} from '@/app/lib/api/projects';
import { CLIENT_STATUSES, MESSAGES, projectsLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * A GSTIN as the backend's `GSTIN_REGEX` defines it — two state digits, a PAN, an
 * entity number, a 'Z', and a checksum character.
 *
 * Duplicated from `buildcore-api/src/settings/companies/dto/create-company.dto.ts`
 * because the two repositories share no code. The pattern is fixed by GST law rather
 * than by either codebase, so it is stable, but the server remains the authority: a
 * value that slips past this is refused there with a 400 the form displays.
 */
const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Add or edit a client (spec US1). */
export default function ClientModal({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(client?.name ?? '');
  const [contactPerson, setContactPerson] = useState(
    client?.contactPerson ?? '',
  );
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [gstin, setGstin] = useState(client?.gstin ?? '');
  const [status, setStatus] = useState<string>(client?.status ?? 'active');

  const [nameError, setNameError] = useState<string | undefined>();
  const [gstinError, setGstinError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ClientInput = {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        // Sent as undefined rather than '' when blank: the column is unique per
        // company where present, and an empty string is a value that would collide
        // with the next GSTIN-less client.
        gstin: gstin.trim() || undefined,
        status,
      };
      return client
        ? updateClient(client.id, payload)
        : createClient(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'clients'] });
      onClose();
    },
    onError: (error: unknown) => {
      // A duplicate GSTIN is a field problem, not a page problem — putting it on
      // the input is what lets someone fix it without hunting for the cause.
      //
      // Safe only because a 409 from this endpoint means exactly one thing: the
      // GSTIN is taken. `POST /projects/clients` has one other refusal, a 400 for a
      // cross-company caller with no company, and that arrives as a different
      // status precisely so this mapping stays unambiguous — the lesson 007 learned
      // the hard way on vendor categories.
      if (error instanceof ApiError && error.status === 409) {
        setGstinError(error.message);
        return;
      }
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      );
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setGstinError(undefined);
    setServerError(null);

    let invalid = false;
    if (!name.trim()) {
      setNameError('Client name is required.');
      invalid = true;
    }
    const trimmedGstin = gstin.trim();
    if (trimmedGstin && !GSTIN_PATTERN.test(trimmedGstin)) {
      setGstinError(MESSAGES.gstinFormat);
      invalid = true;
    }
    if (invalid) return;

    mutation.mutate();
  }

  return (
    <Modal
      title={client ? 'Edit client' : 'Add client'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="client-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
        <FormError message={serverError} />

        <TextField
          id="client-name"
          label="Client name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          required
        />
        <TextField
          id="client-contact"
          label="Contact person"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="client-phone"
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            id="client-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <TextField
          id="client-address"
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <TextField
          id="client-gstin"
          label="GSTIN"
          value={gstin}
          // Typed in lower case more often than not, and the format is upper-case
          // only — correcting it here beats rejecting it on submit.
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          error={gstinError}
          hint="Optional. Must be unique across your clients."
          maxLength={15}
        />
        <SelectField
          id="client-status"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {CLIENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {projectsLabel(value)}
            </option>
          ))}
        </SelectField>
      </form>
    </Modal>
  );
}
