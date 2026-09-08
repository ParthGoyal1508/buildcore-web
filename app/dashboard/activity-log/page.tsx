import ActivityLogList from '@/app/ui/dashboard/activity-log-list';
import PageHeader from '@/app/ui/page-header';

export default function ActivityLogPage() {
  return (
    <main>
      <PageHeader
        title="Activity Log"
        description="A chronological record of changes across the workspace."
        className="mb-4"
      />
      <ActivityLogList />
    </main>
  );
}
