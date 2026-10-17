"use client";

import Link from "next/link";

import {
  RECRUITMENT_TEMPLATE_KIND_KEYS,
  ROUTES,
  TEMPLATE_COPY,
} from "@/app/lib/constants";
import LetterTemplatesManager from "@/app/ui/letters/letter-templates-manager";

/**
 * Recruitment's own letter template — the offer letter (2026-10-14; the appointment letter moved to
 * HR & Payroll on 2026-10-15). Every other kind is HR's, a project's or a payment's, and is managed
 * in Settings → Letter templates.
 */
export default function RecruitmentLetterTemplatesPage() {
  return (
    <LetterTemplatesManager
      kindKeys={RECRUITMENT_TEMPLATE_KIND_KEYS}
      title={TEMPLATE_COPY.title}
      description="The offer letter recruitment issues."
      footnote={
        <>
          The appointment, relieving, experience and other HR letters, and project and
          payment letters, are in{" "}
          <Link
            href={ROUTES.settingsLetterTemplates}
            className="font-medium text-brand-700 underline"
          >
            Settings → Letter templates
          </Link>
          .
        </>
      }
    />
  );
}
