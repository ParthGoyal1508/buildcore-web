'use client';

import { useRef } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { listEmployees, EMPLOYEE_PAGE_MAX } from '@/app/lib/api/hr-payroll';
import { getVendors } from '@/app/lib/api/partners';
import { getEquipment, type Equipment } from '@/app/lib/api/plant';
import { getProjects, getSites } from '@/app/lib/api/projects';
import { quantity3 } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';

/**
 * The plant module's server-searched pickers (036 K15, L2).
 *
 * Every plant form loaded its machines with `pageSize: 200` and its operators with 100 into a plain
 * `<select>` — the 201st machine and the 101st operator simply did not exist on the form, with
 * nothing to say so. These search the server as you type (`AsyncSelect`), page on scroll, and say
 * how many matched.
 *
 * Each takes the `selectedOption` of the current value, for an edit form whose value is not on the
 * first page yet.
 */

const PAGE = 25;

/** `1,234.5 h`, `48,210 km` — a meter reading with its unit. */
export function readingWithUnit(
  value: number | null | undefined,
  meterType: string | null | undefined,
): string {
  if (value === null || value === undefined) return '—';
  return `${quantity3(value)} ${meterType === 'km' ? 'km' : 'h'}`;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface PickerProps {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** Offered first, selecting `''`. Omit to make a choice mandatory. */
  emptyLabel?: string;
  selectedOption?: SearchableOption | null;
}

export function equipmentOption(row: {
  id: string;
  code: string;
  name: string;
}): SearchableOption {
  return { id: row.id, label: row.code, sublabel: row.name };
}

/** A machine. `onChange` hands back the whole row, so a form can prefill from its meter. */
export function EquipmentPicker({
  onChange,
  filters = {},
  ...props
}: PickerProps & {
  onChange: (id: string, machine: Equipment | null) => void;
  filters?: { ownership?: string; siteId?: string; status?: string };
}) {
  const companyId = useSelectedCompanyId();
  const seen = useRef(new Map<string, Equipment>());
  return (
    <Field {...props}>
      <AsyncSelect
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        invalid={Boolean(props.error)}
        emptyLabel={props.emptyLabel}
        selectedOption={props.selectedOption}
        placeholder="Search code, name or registration"
        cacheKey={['plant-equipment', companyId, filters]}
        search={async (term, page) => {
          const result = await getEquipment({
            search: term || undefined,
            page,
            pageSize: PAGE,
            ...filters,
          });
          for (const row of result.items) seen.current.set(row.id, row);
          return {
            total: result.total,
            items: result.items.map((row) => ({
              ...equipmentOption(row),
              note: readingWithUnit(row.currentReading, row.meterType),
            })),
          };
        }}
        onChange={(id) => onChange(id, seen.current.get(id) ?? null)}
      />
    </Field>
  );
}

/** An active employee — an operator or a custodian — optionally only those at one site. */
export function EmployeePicker({
  onChange,
  siteId,
  ...props
}: PickerProps & {
  onChange: (id: string, option: SearchableOption | null) => void;
  siteId?: string;
}) {
  const companyId = useSelectedCompanyId();
  return (
    <Field {...props}>
      <AsyncSelect
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        invalid={Boolean(props.error)}
        emptyLabel={props.emptyLabel}
        selectedOption={props.selectedOption}
        placeholder="Search name or code"
        cacheKey={['employees', companyId, siteId ?? null]}
        search={async (term, page) => {
          const result = await listEmployees({
            isActive: true,
            search: term || undefined,
            siteId: siteId || undefined,
            page,
            pageSize: Math.min(PAGE, EMPLOYEE_PAGE_MAX),
          });
          return {
            total: result.total,
            items: result.items.map((employee) => ({
              id: employee.id,
              label:
                [employee.firstName, employee.lastName]
                  .filter(Boolean)
                  .join(' ') || employee.employeeCode,
              sublabel: employee.employeeCode,
            })),
          };
        }}
        onChange={onChange}
      />
    </Field>
  );
}

export function VendorPicker({
  onChange,
  ...props
}: PickerProps & {
  onChange: (id: string, option: SearchableOption | null) => void;
}) {
  const companyId = useSelectedCompanyId();
  return (
    <Field {...props}>
      <AsyncSelect
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        invalid={Boolean(props.error)}
        emptyLabel={props.emptyLabel}
        selectedOption={props.selectedOption}
        placeholder="Search vendors"
        cacheKey={['vendors', companyId]}
        search={async (term, page) => {
          const result = await getVendors({
            active: true,
            search: term || undefined,
            page,
            pageSize: PAGE,
          });
          return {
            total: result.total,
            items: result.items.map((vendor) => ({
              id: vendor.id,
              label: vendor.name,
            })),
          };
        }}
        onChange={onChange}
      />
    </Field>
  );
}

export function SitePicker({
  onChange,
  projectId,
  ...props
}: PickerProps & {
  onChange: (id: string, option: SearchableOption | null) => void;
  projectId?: string;
}) {
  const companyId = useSelectedCompanyId();
  return (
    <Field {...props}>
      <AsyncSelect
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        invalid={Boolean(props.error)}
        emptyLabel={props.emptyLabel}
        selectedOption={props.selectedOption}
        placeholder="Search sites"
        cacheKey={['sites', companyId, projectId ?? null]}
        search={async (term, page) => {
          const result = await getSites({
            search: term || undefined,
            projectId: projectId || undefined,
            page,
            pageSize: PAGE,
          });
          return {
            total: result.total,
            items: result.items.map((site) => ({
              id: site.id,
              label: site.name,
            })),
          };
        }}
        onChange={onChange}
      />
    </Field>
  );
}

export function ProjectPicker({
  onChange,
  ...props
}: PickerProps & {
  onChange: (id: string, option: SearchableOption | null) => void;
}) {
  const companyId = useSelectedCompanyId();
  return (
    <Field {...props}>
      <AsyncSelect
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        invalid={Boolean(props.error)}
        emptyLabel={props.emptyLabel}
        selectedOption={props.selectedOption}
        placeholder="Search projects"
        cacheKey={['projects', companyId]}
        search={async (term, page) => {
          const result = await getProjects({
            search: term || undefined,
            page,
            pageSize: PAGE,
          });
          return {
            total: result.total,
            items: result.items.map((project) => ({
              id: project.id,
              label: project.name,
              sublabel: project.code ?? undefined,
            })),
          };
        }}
        onChange={onChange}
      />
    </Field>
  );
}
