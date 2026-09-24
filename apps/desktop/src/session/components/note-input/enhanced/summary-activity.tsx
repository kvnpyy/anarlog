import { t } from "@lingui/core/macro";

import {
  ActivityTrail,
  type ActivityStepState,
} from "~/shared/ui/activity-trail";

export function summaryActivityStates(
  preparing: boolean,
  writing: boolean,
): Record<"gather" | "shape" | "write", ActivityStepState> {
  if (writing) {
    return { gather: "done", shape: "done", write: "active" };
  }

  if (preparing) {
    return { gather: "active", shape: "queued", write: "queued" };
  }

  return { gather: "done", shape: "active", write: "queued" };
}

export function SummaryActivity({
  preparing = false,
  writing = false,
  reasoning = false,
  retrying = false,
  localModel = false,
  compact = false,
}: {
  preparing?: boolean;
  writing?: boolean;
  reasoning?: boolean;
  retrying?: boolean;
  localModel?: boolean;
  compact?: boolean;
}) {
  const states = summaryActivityStates(preparing, writing);
  const shapeLabel = retrying
    ? t`Taking another pass`
    : reasoning
      ? t`Thinking it through`
      : t`Shaping the notes`;
  const caption = summaryCaption({
    preparing,
    writing,
    reasoning,
    localModel,
  });

  return (
    <ActivityTrail
      role="status"
      aria-live="polite"
      compact={compact}
      showNoteSkeleton={!compact && !writing}
      caption={caption}
      steps={[
        {
          id: "gather",
          label: t`Gathering the transcript`,
          state: states.gather,
        },
        {
          id: "shape",
          label: shapeLabel,
          state: states.shape,
        },
        {
          id: "write",
          label: t`Writing the notes`,
          state: states.write,
        },
      ]}
    />
  );
}

function summaryCaption({
  preparing,
  writing,
  reasoning,
  localModel,
}: {
  preparing: boolean;
  writing: boolean;
  reasoning: boolean;
  localModel: boolean;
}) {
  if (writing) {
    return undefined;
  }

  if (preparing) {
    return t`Generating your notes from the transcript. This usually takes a few seconds.`;
  }

  if (reasoning) {
    return t`Reasoning models think through the transcript before writing.`;
  }

  if (localModel) {
    return t`On-device models can take a few minutes to warm up before text appears.`;
  }

  return undefined;
}
