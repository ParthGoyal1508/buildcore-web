import ActivityLogList from '@/app/ui/dashboard/activity-log-list';

export default function ActivityLogPage() {
  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">
          Activity Log
        </h1>
        <p className="text-sm text-gray-500">
          A chronological record of changes across the workspace.
        </p>
      </div>
      <ActivityLogList />
    </main>
  );
}
