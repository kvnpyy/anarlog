import { t } from "@lingui/core/macro";
import { ArrowElbowDownRight, Trash } from "@phosphor-icons/react";
import type { ChatStatus } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatBody } from "./body";
import { ContextBar } from "./context-bar";
import { ChatMessageInput } from "./input";
import { LiveAskRail } from "./live-ask-rail";

import type { useLanguageModel } from "~/ai/hooks";
import { chatActivityFromParts } from "~/chat/activity";
import { chatStepLabel } from "~/chat/activity-label";
import { dedupeByKey, type ContextRef } from "~/chat/context/entities";
import {
  hasSessionContextDragData,
  readSessionContextDragData,
} from "~/chat/context/session-drag";
import type { DisplayEntity } from "~/chat/context/use-chat-context-pipeline";
import type { ChatMessageSender, AnlgUIMessage } from "~/chat/types";
import {
  assistantTurnHasAnswerText,
  shouldShowChatThinking,
} from "~/chat/waiting";
import { ActivityTrail } from "~/shared/ui/activity-trail";
import { id } from "~/shared/utils";
import { useFolderFilter } from "~/store/zustand/folder-filter";

type QueuedChatMessage = {
  id: string;
  content: string;
  parts: AnlgUIMessage["parts"];
  contextRefs: ContextRef[];
  modelPrompt?: string;
  transcriptWindowMs?: number;
};

const EMPTY_QUEUED_MESSAGES: readonly QueuedChatMessage[] = Object.freeze([]);

export function ChatContent({
  layout = "floating",
  pageIntegrated = false,
  collapseThread = false,
  sessionId,
  messages,
  sendMessage,
  regenerate,
  stop,
  status,
  error,
  model,
  handleSendMessage,
  contextEntities,
  pendingRefs,
  onRemoveContextEntity,
  onAddContextEntity,
  onDraftContentChange,
  onDraftContextRefsChange,
  isSystemPromptReady,
  isRecording = false,
  isBatchOnly = false,
  placeholder,
  askScope,
  children,
}: {
  layout?: "floating" | "right-panel" | "inline";
  pageIntegrated?: boolean;
  collapseThread?: boolean;
  sessionId: string;
  messages: AnlgUIMessage[];
  sendMessage: ChatMessageSender;
  regenerate: () => void;
  stop: () => void;
  status: ChatStatus;
  error?: Error;
  model: ReturnType<typeof useLanguageModel>;
  handleSendMessage: (
    content: string,
    parts: AnlgUIMessage["parts"],
    sendMessage: ChatMessageSender,
    contextRefs?: ContextRef[],
    modelPrompt?: string,
    transcriptWindowMs?: number,
  ) => void;
  contextEntities: DisplayEntity[];
  pendingRefs: ContextRef[];
  onRemoveContextEntity?: (key: string) => void;
  onAddContextEntity?: (ref: ContextRef) => void;
  onDraftContentChange?: (hasDraftContent: boolean) => void;
  onDraftContextRefsChange?: (refs: ContextRef[]) => void;
  isSystemPromptReady: boolean;
  isRecording?: boolean;
  isBatchOnly?: boolean;
  placeholder?: string;
  askScope?: {
    label: string;
    onToggle: () => void;
  };
  children?: React.ReactNode;
}) {
  const isModelConfigured = !!model;
  const isFloating = layout === "floating";
  const isInline = layout === "inline";
  const showPastAskRecipes =
    !isRecording && (isInline || pageIntegrated) && contextEntities.length > 0;
  const showAskRecipes = isRecording || showPastAskRecipes;
  const hideContextBar = isRecording || isInline || pageIntegrated;
  const disabled = !isSystemPromptReady;
  const isBusy = status === "submitted" || status === "streaming";
  const hideEmptyLiveBody =
    (isInline || pageIntegrated) && messages.length === 0 && !isBusy;
  const hideThread = hideEmptyLiveBody || collapseThread;
  const [awaitingReply, setAwaitingReply] = useState(false);
  const showThinking = shouldShowChatThinking(status, messages, awaitingReply);
  const activityMessage = messages[messages.length - 1];
  const activity = chatActivityFromParts(
    activityMessage?.role === "assistant" ? activityMessage.parts : undefined,
  );
  const activeStep =
    activity.steps.find((step) => step.state === "active") ??
    activity.steps[activity.steps.length - 1];
  const folderName = useFolderFilter((state) => state.activeFolderPath);
  const inputPlaceholder =
    placeholder ??
    (!isRecording && contextEntities.length === 0
      ? folderName
        ? t`Ask this folder`
        : t`Ask across your meetings`
      : undefined);
  const [queueState, setQueueState] = useState<{
    sessionId: string;
    messages: QueuedChatMessage[];
  }>(() => ({ sessionId, messages: [] }));
  const dequeueInFlightRef = useRef(false);
  const queuedMessages =
    queueState.sessionId === sessionId
      ? queueState.messages
      : EMPTY_QUEUED_MESSAGES;
  const mergeContextRefs = useCallback(
    (contextRefs?: ContextRef[]) =>
      contextRefs ? dedupeByKey([pendingRefs, contextRefs]) : pendingRefs,
    [pendingRefs],
  );
  const setQueuedMessages = useCallback(
    (
      next:
        | QueuedChatMessage[]
        | ((messages: QueuedChatMessage[]) => QueuedChatMessage[]),
    ) => {
      setQueueState((prev) => {
        const currentMessages =
          prev.sessionId === sessionId ? prev.messages : [];
        return {
          sessionId,
          messages: typeof next === "function" ? next(currentMessages) : next,
        };
      });
    },
    [sessionId],
  );
  const submitOrQueueMessage = useCallback(
    (
      content: string,
      parts: AnlgUIMessage["parts"],
      contextRefs?: ContextRef[],
      modelPrompt?: string,
      transcriptWindowMs?: number,
    ) => {
      const mergedContextRefs = mergeContextRefs(contextRefs);

      if (isBusy) {
        setQueuedMessages((messages) => [
          ...messages,
          {
            id: id(),
            content,
            parts,
            contextRefs: mergedContextRefs,
            modelPrompt,
            transcriptWindowMs,
          },
        ]);
        return;
      }

      setAwaitingReply(true);
      handleSendMessage(
        content,
        parts,
        sendMessage,
        mergedContextRefs,
        modelPrompt,
        transcriptWindowMs,
      );
    },
    [
      handleSendMessage,
      isBusy,
      mergeContextRefs,
      sendMessage,
      setQueuedMessages,
    ],
  );
  const removeQueuedMessage = useCallback(
    (queuedMessageId: string) => {
      setQueuedMessages((messages) =>
        messages.filter((message) => message.id !== queuedMessageId),
      );
    },
    [setQueuedMessages],
  );

  useEffect(() => {
    if (isBusy) {
      dequeueInFlightRef.current = false;
      return;
    }

    if (
      status !== "ready" ||
      queuedMessages.length === 0 ||
      dequeueInFlightRef.current
    ) {
      return;
    }

    const [nextMessage] = queuedMessages;
    dequeueInFlightRef.current = true;
    setQueuedMessages((messages) => messages.slice(1));
    try {
      setAwaitingReply(true);
      handleSendMessage(
        nextMessage.content,
        nextMessage.parts,
        sendMessage,
        nextMessage.contextRefs,
        nextMessage.modelPrompt,
        nextMessage.transcriptWindowMs,
      );
    } finally {
      dequeueInFlightRef.current = false;
    }
  }, [
    handleSendMessage,
    isBusy,
    queuedMessages,
    sendMessage,
    setQueuedMessages,
    status,
  ]);

  useEffect(() => {
    setAwaitingReply(false);
  }, [sessionId]);

  useEffect(() => {
    if (status === "error") {
      setAwaitingReply(false);
    }
  }, [status]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && assistantTurnHasAnswerText(last)) {
      setAwaitingReply(false);
    }
  }, [messages]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onAddContextEntity || !hasSessionContextDragData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onAddContextEntity) {
      return;
    }

    const contextRef = readSessionContextDragData(event.dataTransfer);

    if (!contextRef) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onAddContextEntity(contextRef);
  };

  return (
    <div
      className={
        isFloating
          ? "flex max-h-full min-h-0 flex-col overflow-hidden"
          : isInline
            ? "flex min-h-0 flex-col overflow-hidden"
            : "flex min-h-0 flex-1 flex-col overflow-hidden"
      }
      data-chat-content
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children ??
        (hideThread ? null : (
          <ChatBody
            messages={messages}
            status={status}
            error={error}
            onReload={regenerate}
            isModelConfigured={isModelConfigured}
            hasContext={contextEntities.length > 0}
            onSendMessage={submitOrQueueMessage}
            isRecording={isRecording}
            layout={layout}
          />
        ))}
      {showAskRecipes ? (
        <LiveAskRail
          variant={isRecording ? "live" : "past"}
          isBatchOnly={isRecording ? isBatchOnly : false}
          showRecipes={isModelConfigured}
          onSendMessage={submitOrQueueMessage}
        />
      ) : null}
      {isModelConfigured && (
        <>
          {hideContextBar ? null : (
            <ContextBar
              entities={contextEntities}
              onRemoveEntity={onRemoveContextEntity}
            />
          )}
          {collapseThread ? null : (
            <ChatQueue
              messages={queuedMessages}
              onRemoveMessage={removeQueuedMessage}
            />
          )}
          {showThinking && !collapseThread ? (
            <ChatThinkingStatus
              parts={
                activityMessage?.role === "assistant"
                  ? activityMessage.parts
                  : undefined
              }
            />
          ) : null}
          {askScope ? (
            <div className="flex shrink-0 justify-center px-1 pb-1.5">
              <button
                type="button"
                data-chat-scope-switch
                onClick={askScope.onToggle}
                className="border-border bg-card text-muted-foreground hover:bg-muted/55 hover:text-foreground inline-flex items-center rounded-full border px-3 py-1 text-xs"
              >
                {askScope.label}
              </button>
            </div>
          ) : null}
          <ChatMessageInput
            draftKey={sessionId}
            layout={layout}
            pageIntegrated={pageIntegrated}
            disabled={disabled}
            onSendMessage={submitOrQueueMessage}
            onDraftContentChange={onDraftContentChange}
            onContextRefsChange={onDraftContextRefsChange}
            isStreaming={
              awaitingReply || status === "streaming" || status === "submitted"
            }
            activityLabel={
              showThinking && activeStep ? chatStepLabel(activeStep) : undefined
            }
            onStop={stop}
            placeholder={inputPlaceholder}
          />
        </>
      )}
    </div>
  );
}

function ChatThinkingStatus({ parts }: { parts?: AnlgUIMessage["parts"] }) {
  const activity = chatActivityFromParts(parts);

  return (
    <ActivityTrail
      role="status"
      aria-live="polite"
      data-chat-thinking-status
      compact
      className="shrink-0 px-4 py-2"
      sourceHeading={t`Pulled from`}
      sources={activity.sources}
      steps={activity.steps.map((step) => ({
        id: step.id,
        label: chatStepLabel(step),
        detail: step.query,
        state: step.failed ? "failed" : step.state,
      }))}
    />
  );
}

function ChatQueue({
  messages,
  onRemoveMessage,
}: {
  messages: readonly QueuedChatMessage[];
  onRemoveMessage: (messageId: string) => void;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div data-chat-queue className="shrink-0 px-3 pb-1.5">
      <div className="mx-auto flex max-w-full flex-col gap-0.5">
        {messages.map((message) => (
          <div
            key={message.id}
            data-chat-queue-item
            className="group text-muted-foreground hover:bg-muted/55 grid min-h-7 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors"
          >
            <ArrowElbowDownRight className="size-3.5" />
            <span className="truncate">{message.content}</span>
            <button
              type="button"
              aria-label={`Remove queued message: ${message.content}`}
              onClick={() => onRemoveMessage(message.id)}
              className="hover:bg-accent/20 inline-flex size-6 items-center justify-center rounded-md opacity-65 transition-opacity group-hover:opacity-100"
            >
              <Trash className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
