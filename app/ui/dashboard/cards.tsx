import {
  UsersIcon,
  BriefcaseIcon,
  TruckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';

const iconMap = {
  employees: UsersIcon,
  projects: BriefcaseIcon,
  machinery: TruckIcon,
  approvals: ClockIcon,
};

// Placeholder counts standing in for the 8 KPI cards in
// docs/prd/00-master-prd.md §7.2.1 — replace with a real call to the
// backend once the HR/Projects/Plant/Reports modules exist.
async function getDashboardSummary() {
  return {
    totalEmployees: 0,
    activeProjects: 0,
    activeMachinery: 0,
    pendingApprovals: 0,
  };
}

export default async function CardWrapper() {
  const summary = await getDashboardSummary();

  return (
    <>
      <Card title="Total Employees" value={summary.totalEmployees} type="employees" />
      <Card title="Active Projects" value={summary.activeProjects} type="projects" />
      <Card title="Active Machinery" value={summary.activeMachinery} type="machinery" />
      <Card title="Pending Approvals" value={summary.pendingApprovals} type="approvals" />
    </>
  );
}

export function Card({
  title,
  value,
  type,
}: {
  title: string;
  value: number | string;
  type: keyof typeof iconMap;
}) {
  const Icon = iconMap[type];

  return (
    <div className="rounded-xl bg-gray-50 p-2 shadow-sm">
      <div className="flex p-4">
        {Icon ? <Icon className="h-5 w-5 text-gray-700" /> : null}
        <h3 className="ml-2 text-sm font-medium">{title}</h3>
      </div>
      <p
        className={`${lusitana.className}
          truncate rounded-xl bg-white px-4 py-8 text-center text-2xl`}
      >
        {value}
      </p>
    </div>
  );
}
