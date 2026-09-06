'use client';

import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  ArrowRightStartOnRectangleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid, { type Tile } from '@/app/ui/tile-grid';

const TILES: Tile[] = [
  {
    name: 'Requisitions',
    href: ROUTES.recruitmentRequisitions,
    icon: ClipboardDocumentListIcon,
    description: 'Open positions and approvals.',
  },
  {
    name: 'Pipeline',
    href: ROUTES.recruitmentPipeline,
    icon: FunnelIcon,
    description:
      'Candidates through Interviews, Selected and Joining Pending.',
  },
  {
    name: 'Interviews',
    href: ROUTES.recruitmentInterviews,
    icon: CalendarDaysIcon,
    description: "Today's and upcoming rounds, with feedback.",
  },
  {
    name: 'Letter Templates',
    href: ROUTES.recruitmentLetterTemplates,
    icon: DocumentDuplicateIcon,
    description: 'Per-company templates with tokens.',
  },
  {
    name: 'Letters',
    href: ROUTES.recruitmentLetters,
    icon: EnvelopeIcon,
    description: 'Generated letters with version history.',
  },
  {
    name: 'Resignations',
    href: ROUTES.recruitmentResignations,
    icon: ArrowRightStartOnRectangleIcon,
    description: 'Separations and last working days.',
  },
];

export default function RecruitmentIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recruitment & Onboarding"
        description="The hiring funnel from an open position to a joined, onboarded employee."
      />
      <TileGrid tiles={TILES} />
    </div>
  );
}
