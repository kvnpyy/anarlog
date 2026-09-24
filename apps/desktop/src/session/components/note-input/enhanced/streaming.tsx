import { Trans } from "@lingui/react/macro";
import { Streamdown } from "streamdown";

import { cn } from "@anlg/utils";

import { streamdownComponents } from "../../streamdown";
import { SummaryActivity } from "./summary-activity";

import { useAITaskTask, useLLMConnection } from "~/ai/hooks";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";
import { getPersistableGeneratedTitle } from "~/store/zustand/ai-task/task-configs/title-success";
import { isLocalModelProviderId } from "~/store/zustand/ai-task/tasks";

function SummaryTitleSpace({ title }: { title: string }) {
  return (
    <div
      data-testid="summary-title-space"
      className="pointer-events-none mb-4 flex min-h-[1.875rem] items-start"
    >
      {title ? (
        <h1 className="text-foreground text-[1.5rem] leading-[1.875rem] font-bold">
          {title}
        </h1>
      ) : (
        <span
          aria-hidden="true"
          className="text-muted-foreground animate-pulse text-[1.5rem] leading-[1.875rem] font-bold opacity-60"
        >
          <Trans>Generating title...</Trans>
        </span>
      )}
    </div>
  );
}

export function StreamingView({
  sessionId,
  sessionTitle,
  enhancedNoteId,
  preparing = false,
}: {
  sessionId: string;
  sessionTitle: string;
  enhancedNoteId: string;
  preparing?: boolean;
}) {
  const taskId = createTaskId(enhancedNoteId, "enhance");
  const { streamedText, isGenerating, currentStep } = useAITaskTask(
    taskId,
    "enhance",
  );
  const { conn } = useLLMConnection();
  const isLocalModel = !!conn && isLocalModelProviderId(conn.providerId);
  const isReasoning = currentStep?.type === "reasoning";
  const titleTaskId = createTaskId(sessionId, "title");
  const { streamedText: streamedTitle, isGenerating: isGeneratingTitle } =
    useAITaskTask(titleTaskId, "title");
  const title = sessionTitle.trim();
  const generatedTitle = isGeneratingTitle
    ? ""
    : getPersistableGeneratedTitle(streamedTitle);
  const visibleTitle = title || generatedTitle;

  if (streamedText.trim().length === 0) {
    return (
      <SummaryActivity
        preparing={preparing}
        reasoning={isReasoning}
        retrying={currentStep?.type === "retrying"}
        localModel={isLocalModel}
      />
    );
  }

  return (
    <div className="pb-2">
      <div className="flex flex-col gap-1">
        <SummaryTitleSpace title={visibleTitle} />
        <Streamdown
          components={streamdownComponents}
          className={cn(["note-typography", "flex flex-col"])}
          caret="block"
          isAnimating={isGenerating}
        >
          {streamedText}
        </Streamdown>
      </div>
    </div>
  );
}
