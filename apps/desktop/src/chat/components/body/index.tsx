import { Trans } from "@lingui/react/macro";
import { CaretDown } from "@phosphor-icons/react";
import type { ChatStatus } from "ai";

import { Button } from "@anlg/ui/components/ui/button";
import { cn } from "@anlg/utils";

import { ChatBodyEmpty } from "./empty";
import { ChatBodyNonEmpty } from "./non-empty";
import { useChatAutoScroll } from "./use-chat-auto-scroll";

import { LoadingMessage } from "~/chat/components/message/loading";
import type { ContextRef } from "~/chat/context/entities";
import { chatFloatingControlClassNames } from "~/chat/surface";
import type { AnlgUIMessage } from "~/chat/types";
import { useShell } from "~/contexts/shell";

export function ChatBody({
  messages,
  status,
  error,
  onReload,
  isModelConfigured = true,
  hasContext = false,
  onSendMessage,
  isRecording = false,
  layout = "floating",
}: {
  messages: AnlgUIMessage[];
  status: ChatStatus;
  error?: Error;
  onReload?: () => void;
  isModelConfigured?: boolean;
  hasContext?: boolean;
  onSendMessage?: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
    contextRefs?: ContextRef[],
  ) => void;
  isRecording?: boolean;
  layout?: "floating" | "right-panel" | "inline";
}) {
  const { chat } = useShell();
  const isRightPanel = chat.mode === "RightPanelOpen";
  const isFloating = chat.mode === "FloatingOpen";
  const isInline = layout === "inline";
  const {
    contentRef,
    isAtBottom,
    scrollRef,
    scrollToBottom,
    showGoToRecent,
    updateAutoScrollState,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handleWheel,
  } = useChatAutoScroll(status);
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div
      className={cn([
        "relative flex min-h-0 flex-col",
        isInline || !isRightPanel ? "flex-auto" : "flex-1",
      ])}
    >
      <div
        ref={scrollRef}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onScroll={updateAutoScrollState}
        onWheel={handleWheel}
        className={cn([
          "flex min-h-0 flex-col overflow-x-hidden overflow-y-auto",
          isInline
            ? "max-h-48 flex-auto"
            : isRightPanel
              ? "flex-1"
              : "max-h-[min(36rem,70vh)] flex-auto",
        ])}
      >
        <div
          ref={contentRef}
          className={cn([
            "flex flex-col",
            isRightPanel && "min-h-full flex-1",
            "px-3 py-3",
          ])}
        >
          {!isFloating && !isInline && <div className="flex-1" />}
          {messages.length === 0 ? (
            isBusy ? (
              <LoadingMessage />
            ) : (
              <ChatBodyEmpty
                isModelConfigured={isModelConfigured}
                hasContext={hasContext}
                onSendMessage={onSendMessage}
                isRecording={isRecording}
              />
            )
          ) : (
            <ChatBodyNonEmpty
              messages={messages}
              status={status}
              error={error}
              onReload={onReload}
            />
          )}
        </div>
      </div>
      {messages.length > 0 && showGoToRecent && !isAtBottom && (
        <Button
          onClick={scrollToBottom}
          size="sm"
          className={cn([
            "absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 transform items-center gap-1 rounded-full border shadow-xs",
            chatFloatingControlClassNames(),
          ])}
          variant="outline"
        >
          <CaretDown size={12} />
          <span className="text-xs">
            <Trans>Go to recent</Trans>
          </span>
        </Button>
      )}
    </div>
  );
}
