'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createBOQGroup,
  createBOQItem,
  getBOQ,
  type BoqGroup,
} from '@/app/lib/api/projects';
import { BOQ_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { useProjectLock } from '@/app/ui/projects/project-lock-context';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

/**
 * Adding a section or a line by hand (008 FR-025, FR-065).
 *
 * **The programme fields are optional and labelled as optional**, which is the amendment showing
 * up in the one place a person meets it. A form that demanded four dates to add one line would
 * make hand entry harder than the tender import it sits beside, and would ask somebody to invent a
 * programme for work nobody has scheduled.
 *
 * Both controls are **absent** when the project is locked rather than disabled, matching how the
 * rest of this application shows a lock — a greyed button invites a click and then a 423.
 */
export default function BoqEntry({ projectId }: { projectId: string }) {
  const { isLocked } = useProjectLock();
  const [open, setOpen] = useState<'section' | 'line' | null>(null);

  const { data: groups } = useQuery({
    queryKey: ['projects', projectId, 'boq'],
    queryFn: () => getBOQ(projectId),
  });

  if (isLocked) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => setOpen('section')}>
        {BOQ_COPY.addSection}
      </Button>
      <SecondaryButton
        type="button"
        onClick={() => setOpen('line')}
        disabled={!groups || groups.length === 0}
      >
        {BOQ_COPY.addLine}
      </SecondaryButton>

      {open === 'section' && (
        <SectionModal projectId={projectId} onClose={() => setOpen(null)} />
      )}
      {open === 'line' && (
        <LineModal
          projectId={projectId}
          groups={groups ?? []}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function useInvalidateBoq(projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
    // The alerts read the same lines through a different endpoint, so they go stale together.
    void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq-alerts'] });
  };
}

function SectionModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const invalidate = useInvalidateBoq(projectId);
  const [boqNo, setBoqNo] = useState('');
  const [name, setName] = useState('');
  const [scopeQty, setScopeQty] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => createBOQGroup(projectId, { boqNo, name, scopeQty }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      title={BOQ_COPY.addSection}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            {BOQ_COPY.cancel}
          </SecondaryButton>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              if (!boqNo.trim() || !name.trim()) {
                setError(BOQ_COPY.sectionName);
                return;
              }
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? BOQ_COPY.saving : BOQ_COPY.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          id="boq-section-no"
          label={BOQ_COPY.columnBoqNo}
          value={boqNo}
          onChange={(event) => setBoqNo(event.target.value)}
        />
        <TextField
          id="boq-section-name"
          label={BOQ_COPY.sectionName}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          id="boq-section-scope"
          label={BOQ_COPY.scopeQty}
          value={scopeQty}
          onChange={(event) => setScopeQty(event.target.value)}
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

function LineModal({
  projectId,
  groups,
  onClose,
}: {
  projectId: string;
  groups: BoqGroup[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateBoq(projectId);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [boqNo, setBoqNo] = useState('');
  const [taskName, setTaskName] = useState('');
  const [unit, setUnit] = useState('');
  const [scopeQty, setScopeQty] = useState('');
  const [rate, setRate] = useState('');
  const [finishDate, setFinishDate] = useState('');
  const [perDayQty, setPerDayQty] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      createBOQItem(projectId, {
        groupId,
        boqNo,
        taskName,
        unit,
        scopeQty,
        // Each sent only when it has a value. An empty string would be a date the server has to
        // reject, and a zero would be a programme nobody set.
        rate: rate.trim() || undefined,
        finishDate: finishDate || undefined,
        perDayQty: perDayQty.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      title={BOQ_COPY.addLine}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            {BOQ_COPY.cancel}
          </SecondaryButton>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              if (!groupId || !boqNo.trim() || !taskName.trim() || !unit.trim() || !scopeQty.trim()) {
                setError(BOQ_COPY.taskName);
                return;
              }
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? BOQ_COPY.saving : BOQ_COPY.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          id="boq-line-group"
          label={BOQ_COPY.sectionLabel}
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.boqNo} — {group.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="boq-line-no"
          label={BOQ_COPY.columnBoqNo}
          value={boqNo}
          onChange={(event) => setBoqNo(event.target.value)}
        />
        <TextField
          id="boq-line-task"
          label={BOQ_COPY.taskName}
          value={taskName}
          onChange={(event) => setTaskName(event.target.value)}
        />
        <TextField
          id="boq-line-unit"
          label={BOQ_COPY.unitLabel}
          hint={BOQ_COPY.unitHint}
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
        />
        <TextField
          id="boq-line-scope"
          label={BOQ_COPY.scopeQty}
          value={scopeQty}
          onChange={(event) => setScopeQty(event.target.value)}
        />
        <TextField
          id="boq-line-rate"
          label={BOQ_COPY.rate}
          hint={BOQ_COPY.rateHint}
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />

        <p className="text-xs text-gray-500">{BOQ_COPY.programmeHint}</p>
        <TextField
          id="boq-line-finish"
          type="date"
          label={BOQ_COPY.finishDate}
          value={finishDate}
          onChange={(event) => setFinishDate(event.target.value)}
        />
        <TextField
          id="boq-line-perday"
          label={BOQ_COPY.perDay}
          value={perDayQty}
          onChange={(event) => setPerDayQty(event.target.value)}
        />

        <FormError message={error} />
      </div>
    </Modal>
  );
}
