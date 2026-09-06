import type { Metadata } from 'next';
import FaceEnrolmentStatusPanel from '@/app/ui/my/face-enrolment-status';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Face Enrolment' };

export default function MyFaceEnrolPage() {
  return (
    <main>
      <PageHeader title="Face Enrolment" className="mb-4" />
      <FaceEnrolmentStatusPanel />
    </main>
  );
}
