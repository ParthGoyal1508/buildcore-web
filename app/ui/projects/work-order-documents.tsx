'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getAward,
  getBillableBoq,
  type Award,
  type WorkOrder,
} from '@/app/lib/api/billing';
import { getLetters, type IssuedLetter } from '@/app/lib/api/letters';
import { getVendor, type VendorDetail } from '@/app/lib/api/partners';
import { WORK_ORDER_COPY } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  LetterComposer,
  LetterTable,
  useLetterKinds,
} from '@/app/ui/letters/letters-panel';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';
import NocPanel from '@/app/ui/nocs/noc-panel';

/**
 * Rates first, then the LOI, then the work order — one record, three stages (2026-10-15).
 *
 * The client: "When we are generating the work order we are finalising the subcontractor's rate,
 * but instead we need to finalise the rates beforehand and then generate the work order later. The
 * flow is: rates are finalised first, then the LOI is generated in the attached format, and later
 * the work order can be generated for that subcontractor."
 *
 * So the record that used to be "a work order with an award" is now read in that order. Its draft is
 * the rates being finalised, and sending it for approval sends the rates. Once they are approved the
 * record is where the two documents come from: the LOI, its BOQ annexure filled from the approved
 * rates, and later the work order, from the same rates and quoting the LOI. The rates cannot move
 * underneath either — capturing an award is refused outside a draft — and bills still need the
 * record approved, exactly as before.
 *
 * ## How a letter is known to belong to this record
 *
 * Both letters address the project (so they list on its Letters tab as well) and carry this record's
 * id as `workOrderId`, a variable no template declares. The letters module stores and returns what
 * was typed without reading it, and this screen lists the project's letters carrying its id. A
 * letter composed on the Letters tab directly carries none, and is not claimed here.
 */
const LOI = 'letter_loi';
const WORK_ORDER = 'letter_work_order';

/** One cell of the server's item line: no pipes (they separate cells), on one line. */
const cell = (value: string) =>
  value
    .replace(/\|/g, '/')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

/**
 * The approved rates as the letters' item lines — `BOQ no - description | unit | qty | rate`, the
 * format `LineItemsEditor` reads and the server expands into the printed table.
 */
function lineItemsFrom(award: Award, boqNoOf: Map<string, string>): string {
  return award.lines
    .map((line) => {
      const boqNo = line.boqTaskItemId
        ? boqNoOf.get(line.boqTaskItemId)
        : undefined;
      // An award line picked from the BOQ already reads by its number in some imports; not twice.
      const description =
        boqNo && !line.description.startsWith(boqNo)
          ? `${boqNo} - ${line.description}`
          : line.description;
      return [
        cell(description),
        cell(line.unit),
        String(line.awardedQty),
        String(line.rate),
      ].join(' | ');
    })
    .join('\n');
}

/** The subcontractor's details as the letters print them. */
function vendorFields(
  vendor: VendorDetail | undefined,
  fallbackName: string,
): Record<string, string> {
  if (!vendor) return { vendorName: fallbackName };
  const place = [vendor.address, vendor.city, vendor.state]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  const contact = vendor.contacts.find((c) => c.phone || c.email);
  return {
    vendorName: vendor.name,
    vendorAddress: vendor.pinCode
      ? `${place}${place ? ' - ' : ''}${vendor.pinCode}`
      : place,
    vendorCode: vendor.code,
    vendorMobile: contact?.phone ?? '',
    vendorEmail: contact?.email ?? '',
    vendorPan: vendor.pan ?? '',
    vendorGstin: vendor.gstin ?? '',
    subcontractorAttention: vendor.contacts[0]?.name ?? '',
  };
}

const issued = (letter: IssuedLetter) => letter.status !== 'composed';

export default function WorkOrderDocuments({
  order,
  vendorName,
}: {
  order: WorkOrder;
  /** The subcontractor's name from the panel's list — used when the vendor record cannot be read. */
  vendorName: string;
}) {
  const { project } = useProjectShell();
  const projectId = order.projectId;
  const [composing, setComposing] = useState<
    typeof LOI | typeof WORK_ORDER | null
  >(null);
  const kinds = useLetterKinds([LOI, WORK_ORDER]);
  const kindOf = (key: string) => kinds.offered.find((k) => k.key === key);

  const approved = order.status === 'active' || order.status === 'completed';

  // The same keys the rates editor and the Letters tab read, so nothing here is a second fetch.
  const award = useQuery({
    queryKey: ['raAward', order.id, null],
    queryFn: () => getAward(order.id),
    enabled: approved,
  });
  const boq = useQuery({
    queryKey: ['billableBoq', projectId],
    queryFn: () => getBillableBoq(projectId),
    retry: false,
    enabled: approved,
  });
  // The Partners record, for the address, PAN and contact. Optional: somebody issuing letters may
  // not hold Partners, and the fields are then typed rather than the letter refused.
  const vendor = useQuery({
    queryKey: ['vendor', order.partnerId],
    queryFn: () => getVendor(order.partnerId ?? ''),
    enabled: approved && order.partnerId !== null,
    retry: false,
  });
  const letters = useQuery({
    queryKey: ['letters', 'project', projectId],
    queryFn: () => getLetters({ subjectType: 'project', subjectId: projectId }),
  });

  const mine = (letters.data ?? []).filter(
    (letter) => letter.composedVariables.workOrderId === order.id,
  );
  // Newest first, as the API lists them — so the first issued LOI is the one in force.
  const latestLoi = mine.find((l) => l.letterKindKey === LOI && issued(l));
  const anyLoi = mine.find((l) => l.letterKindKey === LOI);
  const latestWo = mine.find(
    (l) => l.letterKindKey === WORK_ORDER && issued(l),
  );
  const anyWo = mine.find((l) => l.letterKindKey === WORK_ORDER);

  const ready =
    award.isSuccess &&
    !boq.isLoading &&
    !vendor.isLoading &&
    !letters.isLoading;

  const initialValues = (): Record<string, string> => {
    const boqNoOf = new Map(
      (boq.data?.groups ?? []).flatMap((group) =>
        group.items.map((item) => [item.id, item.boqNo] as const),
      ),
    );
    const common: Record<string, string> = {
      // Not a field on either letter: how this record finds the letter again (see above).
      workOrderId: order.id,
      ...vendorFields(vendor.data, vendorName),
      lineItems: award.data ? lineItemsFrom(award.data, boqNoOf) : '',
      scope: order.workDetail,
      scopeDetail: order.workDetail,
      scopeBrief: order.workDetail,
      workLocation: project.location ?? '',
      deliveryAddress: project.location
        ? `${project.name}, ${project.location}`
        : project.name,
    };
    if (order.retentionPercent > 0) {
      common.retention = `${(order.retentionPercent * 100).toFixed(2).replace(/\.?0+$/, '')}% of each RA bill`;
    }
    if (latestLoi) {
      common.loiReference = [
        latestLoi.referenceNo,
        latestLoi.issuedAt ? dateLabel(String(latestLoi.issuedAt)) : null,
      ]
        .filter(Boolean)
        .join(' dated ');
    }
    return common;
  };

  const stageText = (letter: IssuedLetter | undefined) =>
    !letter
      ? WORK_ORDER_COPY.stageNotYet
      : issued(letter)
        ? WORK_ORDER_COPY.stageIssued(letter.referenceNo)
        : WORK_ORDER_COPY.stageAwaiting;

  const stages = [
    {
      name: WORK_ORDER_COPY.stageRates,
      done: approved,
      text: approved
        ? WORK_ORDER_COPY.stageRatesApproved
        : order.status === 'pending_approval'
          ? WORK_ORDER_COPY.stageAwaiting
          : WORK_ORDER_COPY.stageRatesDraft,
    },
    {
      name: WORK_ORDER_COPY.stageLoi,
      done: Boolean(latestLoi),
      text: stageText(latestLoi ?? anyLoi),
    },
    {
      name: WORK_ORDER_COPY.stageWorkOrder,
      done: Boolean(latestWo),
      text: stageText(latestWo ?? anyWo),
    },
  ];

  const composingKind = composing ? kindOf(composing) : undefined;

  return (
    <section className="space-y-3 rounded border border-gray-200 p-3">
      <h3 className="text-sm font-semibold text-gray-900">
        {WORK_ORDER_COPY.documentsHeading}
      </h3>

      <ol className="grid gap-2 sm:grid-cols-3">
        {stages.map((stage, index) => (
          <li
            key={stage.name}
            className={`rounded border px-3 py-2 text-sm ${
              stage.done
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span className="block font-medium text-gray-900">
              {index + 1}. {stage.name}
            </span>
            <span className="block text-xs text-gray-600">{stage.text}</span>
          </li>
        ))}
      </ol>

      {!approved ? (
        <p className="text-xs text-gray-500">
          {WORK_ORDER_COPY.documentsLocked}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {kindOf(LOI) && (
              <Button
                type="button"
                disabled={!ready}
                onClick={() => setComposing(LOI)}
              >
                {WORK_ORDER_COPY.issueLoi}
              </Button>
            )}
            {kindOf(WORK_ORDER) && (
              <Button
                type="button"
                disabled={!ready}
                onClick={() => setComposing(WORK_ORDER)}
              >
                {WORK_ORDER_COPY.issueWorkOrder}
              </Button>
            )}
            {kinds.isSuccess && kinds.offered.length === 0 && (
              <span className="text-xs text-gray-500">
                {WORK_ORDER_COPY.documentsNoKinds}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {latestLoi || !kindOf(LOI)
              ? WORK_ORDER_COPY.documentsHint
              : WORK_ORDER_COPY.documentsHintNoLoi}
          </p>
          {award.isError && (
            <p className="text-xs text-red-700" role="alert">
              {WORK_ORDER_COPY.documentsRatesUnreadable}
            </p>
          )}

          {composing && composingKind && ready && (
            <LetterComposer
              key={composing}
              kind={composingKind}
              title={`${composingKind.label} — ${order.code ?? order.workDetail}`}
              subjectType="project"
              subjectId={projectId}
              projectId={projectId}
              itemsSource="boq"
              initialValues={initialValues()}
              onClose={() => setComposing(null)}
              onIssued={() => setComposing(null)}
            />
          )}
        </>
      )}

      {mine.length > 0 && (
        <LetterTable letters={mine} isLoading={false} emptyMessage="" />
      )}

      {/* The NOCs that follow each document (2026-10-15): one place once the LOI is generated,
          another once the work order is. Shown only after the document exists — a NOC answers
          a letter, and before it there is nothing to answer. */}
      {(anyLoi || anyWo) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {anyLoi && (
            <NocPanel
              subjectType="work_order"
              subjectId={order.id}
              stage="loi"
              title="NOC after the LOI"
            />
          )}
          {anyWo && (
            <NocPanel
              subjectType="work_order"
              subjectId={order.id}
              stage="work_order"
              title="NOC after the work order"
            />
          )}
        </div>
      )}
    </section>
  );
}
