"use client";

import Link from "next/link";

import {
  RECRUITMENT_TEMPLATE_KIND_KEYS,
  ROUTES,
  TEMPLATE_COPY,
} from "@/app/lib/constants";
import LetterTemplatesManager from "@/app/ui/letters/letter-templates-manager";

/**
 * Recruitment's own letter templates — the offer and appointment letters (2026-10-14). Every other
 * kind is HR's, a project's or a payment's, and is managed in Settings → Letter templates.
 */
export default function RecruitmentLetterTemplatesPage() {
  return (
    <LetterTemplatesManager
      kindKeys={RECRUITMENT_TEMPLATE_KIND_KEYS}
      title={TEMPLATE_COPY.title}
      description="The offer and appointment letters recruitment issues."
      footnote={
        <>
          Relieving, experience and the other HR letters, and project and
          payment letters, are in{" "}
          <Link
            href={ROUTES.settingsLetterTemplates}
            className="font-medium text-blue-700 underline"
          >
            Settings → Letter templates
          </Link>
          .
        </>
      }
    />
  );
}
