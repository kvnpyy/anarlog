import type { EditorView } from "prosemirror-view";
import { forwardRef, useMemo } from "react";

import type { NoteEditorRef } from "@anlg/editor/note";

import { ConfigError } from "./config-error";
import { EnhancedEditor } from "./editor";
import { EmptyEnhanced } from "./empty";
import { EnhanceError } from "./enhance-error";
import { getStreamedEnhancePreview } from "./stream-preview";
import { StreamingView } from "./streaming";

import { useAITaskTask } from "~/ai/hooks";
import { useLLMConnectionStatus } from "~/ai/hooks";
import { useAutoEnhancePending } from "~/services/enhancer/pending-ui";
import { hasStoredNoteContent } from "~/session/components/shared";
import { shouldShowEmptySummaryConfigError } from "~/session/enhance-config";
import { useEnhancedNote } from "~/session/queries";
import { createTaskId } from "~/store/zustand/ai-task/task-configs";

export const Enhanced = forwardRef<
  NoteEditorRef,
  {
    sessionId: string;
    sessionTitle: string;
    enhancedNoteId: string | null;
    onNavigateToTitle?: (pixelWidth?: number) => void;
    onViewReady?: (view: EditorView) => void;
    onViewDisposed?: (view: EditorView) => void;
  }
>(
  (
    {
      sessionId,
      sessionTitle,
      enhancedNoteId,
      onNavigateToTitle,
      onViewReady,
      onViewDisposed,
    },
    ref,
  ) => {
    const taskId = enhancedNoteId
      ? createTaskId(enhancedNoteId, "enhance")
      : null;
    const llmStatus = useLLMConnectionStatus();
    const { status, error, streamedText } = useAITaskTask(taskId, "enhance");
    const enhancedNote = useEnhancedNote(enhancedNoteId ?? "");
    const content = enhancedNote?.content;
    const isConfigError = shouldShowEmptySummaryConfigError(llmStatus);
    const isPending = useAutoEnhancePending(sessionId);

    const hasContent = hasStoredNoteContent(content);
    const isAwaitingPersistedContent =
      status === "success" && streamedText.trim().length > 0 && !hasContent;
    const showStreaming =
      status === "generating" ||
      isAwaitingPersistedContent ||
      (isPending && !hasContent && status !== "error");
    const streamPreview = useMemo(
      () =>
        showStreaming ? getStreamedEnhancePreview(streamedText) : undefined,
      [showStreaming, streamedText],
    );

    if (!enhancedNoteId) {
      return isConfigError ? <ConfigError /> : <EmptyEnhanced />;
    }

    if (status === "error") {
      return (
        <EnhanceError
          sessionId={sessionId}
          enhancedNoteId={enhancedNoteId}
          error={error}
          isUnauthenticated={
            llmStatus.status === "error" &&
            llmStatus.reason === "unauthenticated"
          }
        />
      );
    }

    if (!enhancedNote && !showStreaming) {
      return isConfigError ? <ConfigError /> : <EmptyEnhanced />;
    }

    if (status === "idle" && isConfigError && !hasContent) {
      return <ConfigError />;
    }

    if (showStreaming && !streamPreview) {
      return (
        <StreamingView
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          enhancedNoteId={enhancedNoteId}
          preparing={status !== "generating"}
        />
      );
    }

    if (showStreaming && streamPreview) {
      return (
        <EnhancedEditor
          key={`${enhancedNoteId}-preview`}
          ref={ref}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          enhancedNoteId={enhancedNoteId}
          content={enhancedNote?.content ?? ""}
          contentOverride={streamPreview}
          onNavigateToTitle={onNavigateToTitle}
          onViewReady={onViewReady}
          onViewDisposed={onViewDisposed}
        />
      );
    }

    if (!enhancedNote) {
      return <EmptyEnhanced />;
    }

    return (
      <EnhancedEditor
        ref={ref}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        enhancedNoteId={enhancedNoteId}
        content={enhancedNote.content}
        onNavigateToTitle={onNavigateToTitle}
        onViewReady={onViewReady}
        onViewDisposed={onViewDisposed}
      />
    );
  },
);
