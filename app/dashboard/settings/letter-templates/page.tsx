"use client";

import { LETTER_TEMPLATE_GROUPS, TEMPLATE_COPY } from "@/app/lib/constants";
import LetterTemplatesManager from "@/app/ui/letters/letter-templates-manager";

/**
 * Every letter template the company has, grouped by the module that issues it (2026-10-14).
 * The editor was Recruitment's, and listed a relieving letter beside the offer letter.
 */
export default function SettingsLetterTemplatesPage() {
  return (
    <LetterTemplatesManager
      groups={LETTER_TEMPLATE_GROUPS}
      title="Letter Templates"
      description={TEMPLATE_COPY.description}
    />
  );
}
