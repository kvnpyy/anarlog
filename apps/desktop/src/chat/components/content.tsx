import { t } from "@lingui/core/macro";
import { ArrowElbowDownRight, CircleNotch, Trash } from "@phosphor-icons/react";
import type { ChatStatus } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatBody } from "./body";
import { ContextBar } from "./context-bar";
import { ChatMessageInput } from "./input";
import { LiveAskRail } from "./live-ask-rail";

import type { useLanguageModel } from "~/ai/hooks";
import { dedupeByKey, type ContextRef } from "~/chat/context/entities";
import {
  hasSessionContextDragData,
  readSessionContextDragData,
} from "~/chat/context/session-drag";
import type { DisplayEntity } from "~/chat/context/use-chat-context-pipeline";
import { hasRenderableContent } from "~/chat/message-content";
import type { ChatMessageSender, AnlgUIMessage } from "~/chat/types";
import {
  isWaitingForAssistantContent,
  shouldShowChatThinking,
} from "~/chat/waiting";
import { id } from "~/shared/utils";
import { useFolderFilter } from "~/store/zustand/folder-filter";

type QueuedChatMessage = {
  id: string;
  content: string;
  parts: AnlgUIMessage["parts"];
  contextRefs: ContextRef[];
  modelPrompt?: string;
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
  children?: React.ReactNode;
}) {
  const isModelConfigured = !!model;
  const isFloating = layout === "floating";
  const isInline = layout === "inline";
  const disabled = !isSystemPromptReady;
  const isBusy = status === "submitted" || status === "streaming";
  const hideEmptyLiveBody =
    (isInline || pageIntegrated) && messages.length === 0 && !isBusy;
  const hideThread = hideEmptyLiveBody || collapseThread;
  const [awaitingReply, setAwaitingReply] = useState(false);
  const showThinking = shouldShowChatThinking(status, messages, awaitingReply);
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
    if (
      last?.role === "assistant" &&
      hasRenderableContent(last) &&
      !isWaitingForAssistantContent(last)
    ) {
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
      {isRecording ? (
        <LiveAskRail
          isBatchOnly={isBatchOnly}
          showRecipes={isModelConfigured}
          onSendMessage={submitOrQueueMessage}
        />
      ) : null}
      {isModelConfigured && (
        <>
          <ContextBar
            entities={contextEntities}
            onRemoveEntity={onRemoveContextEntity}
          />
          {collapseThread ? null : (
            <ChatQueue
              messages={queuedMessages}
              onRemoveMessage={removeQueuedMessage}
            />
          )}
          {showThinking && !collapseThread ? <ChatThinkingStatus /> : null}
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
            onStop={stop}
            placeholder={inputPlaceholder}
          />
        </>
      )}
    </div>
  );
}

function ChatThinkingStatus() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-chat-thinking-status
      className="text-foreground flex shrink-0 items-center gap-2 px-4 py-2 text-sm"
    >
      <CircleNotch className="size-3.5 shrink-0 animate-spin" />
      <span>{t`Thinking...`}</span>
      <span aria-hidden="true" className="flex items-center gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1 animate-bounce rounded-full bg-current" />
      </span>
    </div>
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
