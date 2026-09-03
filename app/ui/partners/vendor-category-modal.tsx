'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  VendorCategory,
  createVendorCategory,
  updateVendorCategory,
} from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

export default function VendorCategoryModal({
  category,
  onClose,
}: {
  category: VendorCategory | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      category
        ? updateVendorCategory(category.id, {
            name: name.trim(),
            description: description.trim(),
          })
        : createVendorCategory({
            name: name.trim(),
            description: description.trim(),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', 'vendor-categories'] });
      onClose();
    },
    onError: (error: unknown) => {
      // A duplicate name is a field problem, not a page problem — putting it on the
      // input is what lets someone fix it without hunting for the cause.
      //
      // This mapping is only safe because a 409 from this endpoint means exactly one
      // thing: the name is taken (see the controller's @ApiConflictResponse). It
      // briefly meant two — the "companyId is required for a cross-company caller"
      // refusal was also a 409, and so rendered under the name field, where it made
      // no sense. That refusal is a 400 now. If a second 409 is ever added here,
      // this branch has to distinguish them rather than assume.
      if (error instanceof ApiError && error.status === 409) {
        setNameError(error.message);
        return;
      }
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      );
    },
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setServerError(null);
    if (!name.trim()) {
      setNameError('Category name is required');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      title={category ? `Edit ${category.name}` : 'Add vendor category'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="vendor-category-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="vendor-category-form" onSubmit={onSubmit} className="space-y-4">
        <FormError message={serverError} />
        <TextField
          id="category-name"
          label="Category name"
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          id="category-description"
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </form>
    </Modal>
  );
}
