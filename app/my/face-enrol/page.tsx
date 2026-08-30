import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import FaceEnrolmentStatusPanel from '@/app/ui/my/face-enrolment-status';

export const metadata: Metadata = { title: 'Face Enrolment' };

export default function MyFaceEnrolPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-2xl`}>Face Enrolment</h1>
      <FaceEnrolmentStatusPanel />
    </main>
  );
}
