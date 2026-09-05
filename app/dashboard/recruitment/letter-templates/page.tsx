'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createLetterTemplate,
  getLetterTemplates,
  updateLetterTemplate,
  type LetterTemplate,
} from '@/app/lib/api/recruitment';
import { LETTER_TYPES, recruitmentLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import StatusBadge from '@/app/ui/status-badge';
import { useCompanyContext } from '@/app/ui/settings/company-context';

/** Documented token set per letter type — mirrors the backend's LETTER_TOKENS so
 * unknown tokens are highlighted before save (spec FR-011). */
const LETTER_TOKENS: Record<string, string[]> = {
  offer: ['candidateName', 'designation', 'department', 'offeredCtc', 'joiningDate', 'probationMonths', 'noticePeriodDays', 'companyName', 'issueDate'],
  appointment: ['employeeName', 'employeeCode', 'designation', 'department', 'dateOfJoining', 'reportingManager', 'companyName', 'issueDate'],
  confirmation: ['employeeName', 'employeeCode', 'designation', 'confirmationDate', 'companyName', 'issueDate'],
  relieving: ['employeeName', 'employeeCode', 'designation', 'dateOfJoining', 'lastWorkingDay', 'companyName', 'issueDate'],
  experience: ['employeeName', 'employeeCode', 'designation', 'dateOfJoining', 'lastWorkingDay', 'tenure', 'companyName', 'issueDate'],
};

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
function unknownTokens(body: string, type: string): string[] {
  const allowed = new Set(LETTER_TOKENS[type] ?? []);
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(body)) !== null) if (!allowed.has(m[1])) found.add(m[1]);
  return [...found];
}

export default function LetterTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LetterTemplate | null | 'new'>(null);

  const templates = useQuery({ queryKey: ['letter-templates'], queryFn: () => getLetterTemplates() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['letter-templates'] });

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Letter Templates</h1>
          <p className="text-sm text-gray-500">One active template per type; tokens validated on save.</p>
        </div>
        <Button onClick={() => setEditing('new')}>New Template</Button>
      </div>

      <div className="space-y-2">
        {templates.data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm">
            <span>
              {recruitmentLabel(t.letterType)} — {t.name}{' '}
              {t.isActive && <StatusBadge status="active" label="Active" />}
            </span>
            <RowAction onClick={() => setEditing(t)}>Edit</RowAction>
          </div>
        ))}
        {templates.data?.length === 0 && <p className="text-sm text-gray-500">No templates yet.</p>}
      </div>

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: LetterTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // The company a cross-company Super Admin has selected; null for everyone else,
  // who is pinned to their own company by the backend anyway.
  const { companyId } = useCompanyContext();
  const [letterType, setLetterType] = useState(template?.letterType ?? 'offer');
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.bodyTemplate ?? '');
  const [isActive, setIsActive] = useState(template?.isActive ?? false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const unknown = unknownTokens(body, letterType);
  const tokens = LETTER_TOKENS[letterType] ?? [];

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    const insert = `{{${token}}}`;
    if (!el) {
      setBody((b) => b + insert);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setBody((b) => b.slice(0, start) + insert + b.slice(end));
  };

  const mutation = useMutation({
    mutationFn: () =>
      template
        ? updateLetterTemplate(template.id, { name, bodyTemplate: body, isActive })
        : createLetterTemplate({
            letterType,
            name,
            bodyTemplate: body,
            isActive,
            ...(companyId ? { companyId } : {}),
          }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save the template.'),
  });

  return (
    <Modal
      title={template ? 'Edit Template' : 'New Template'}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => { setError(null); mutation.mutate(); }}
            disabled={!name || !body || unknown.length > 0}
            title={unknown.length > 0 ? `Unknown tokens: ${unknown.join(', ')}` : undefined}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="t-type" label="Letter type" value={letterType} onChange={(e) => setLetterType(e.target.value as typeof letterType)} disabled={!!template}>
            {LETTER_TYPES.map((t) => <option key={t} value={t}>{recruitmentLabel(t)}</option>)}
          </SelectField>
          <TextField id="t-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
            <textarea
              ref={textareaRef}
              className="h-56 w-full rounded-lg border border-gray-200 p-3 text-sm font-mono"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Tokens</p>
            <div className="flex flex-wrap gap-1">
              {tokens.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                  onClick={() => insertToken(t)}
                >
                  {`{{${t}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        {unknown.length > 0 && (
          <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
            Unknown tokens: {unknown.join(', ')}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (deactivates any other active template of this type)
        </label>
      </div>
    </Modal>
  );
}
