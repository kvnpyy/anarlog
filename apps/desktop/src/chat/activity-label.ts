import { t } from "@lingui/core/macro";

import type { ChatActivityStep } from "./activity";

export function chatStepLabel(step: ChatActivityStep): string {
  if (step.kind === "think") {
    return t`Thinking...`;
  }

  if (step.kind === "write") {
    return t`Writing the answer`;
  }

  if (step.failed) {
    return t`That step didn't finish`;
  }

  const active = step.state === "active";
  switch (step.tool) {
    case "search_meetings":
    case "list_meetings":
    case "search_sessions":
      return active ? t`Searching your meetings` : t`Searched your meetings`;
    case "search_meeting_content":
      return active
        ? t`Searching notes and transcripts`
        : t`Searched notes and transcripts`;
    case "get_meeting":
      return active ? t`Opening a meeting` : t`Opened a meeting`;
    case "get_meeting_transcript":
      return active ? t`Reading the transcript` : t`Read the transcript`;
    case "find_related_meetings":
      return active ? t`Finding related meetings` : t`Found related meetings`;
    case "get_recurring_meeting_history":
      return active
        ? t`Checking earlier meetings`
        : t`Checked earlier meetings`;
    case "search_contacts":
      return active ? t`Looking up people` : t`Looked up people`;
    case "search_calendar_events":
      return active ? t`Checking your calendar` : t`Checked your calendar`;
    case "web_search":
      return active ? t`Searching the web` : t`Searched the web`;
    case "edit_memo":
    case "edit_summary":
      return active ? t`Drafting a change` : t`Drafted a change`;
    default:
      return active ? t`Working on it` : t`Finished a step`;
  }
}
