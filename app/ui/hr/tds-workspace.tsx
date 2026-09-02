'use client';

import { useState } from 'react';

import FormSixteenView from '@/app/ui/hr/form-sixteen-view';
import QuarterlyTdsReport from '@/app/ui/hr/quarterly-tds-report';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import TaxDeclarationForm from '@/app/ui/hr/tax-declaration-form';
import TaxSlabEditor from '@/app/ui/hr/tax-slab-editor';

const TABS = [
  { id: 'slabs', label: 'Tax slabs' },
  { id: 'declarations', label: 'Declarations' },
  { id: 'quarterly', label: 'Quarterly return' },
  { id: 'form16', label: 'Form 16' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function TdsWorkspace() {
  const [tab, setTab] = useState<TabId>('slabs');
  return (
    <div className="flex flex-col gap-2">
      <TabStrip tabs={TABS} active={tab} onChange={setTab} idPrefix="tds" />
      <TabPanel id="slabs" idPrefix="tds" active={tab}>
        <TaxSlabEditor />
      </TabPanel>
      <TabPanel id="declarations" idPrefix="tds" active={tab}>
        <TaxDeclarationForm />
      </TabPanel>
      <TabPanel id="quarterly" idPrefix="tds" active={tab}>
        <QuarterlyTdsReport />
      </TabPanel>
      <TabPanel id="form16" idPrefix="tds" active={tab}>
        <FormSixteenView />
      </TabPanel>
    </div>
  );
}
