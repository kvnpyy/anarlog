import { t } from "@lingui/core/macro";

import { MessageBubble, MessageContainer } from "./shared";

import { chatActivityFromParts } from "~/chat/activity";
import { chatStepLabel } from "~/chat/activity-label";
import type { AnlgUIMessage } from "~/chat/types";
import { ActivityTrail } from "~/shared/ui/activity-trail";

export function LoadingMessage({ message }: { message?: AnlgUIMessage }) {
  const activity = chatActivityFromParts(message?.parts);

  return (
    <MessageContainer align="start">
      <MessageBubble variant="loading">
        <ActivityTrail
          role="status"
          aria-live="polite"
          data-chat-thinking
          className="min-w-56 border-0 bg-transparent px-0 py-0"
          sourceHeading={t`Pulled from`}
          sources={activity.sources}
          steps={activity.steps.map((step) => ({
            id: step.id,
            label: chatStepLabel(step),
            detail: step.query,
            state: step.failed ? "failed" : step.state,
          }))}
        />
      </MessageBubble>
    </MessageContainer>
  );
}
