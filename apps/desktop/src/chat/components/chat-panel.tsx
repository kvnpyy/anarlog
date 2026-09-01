import { type ReactNode, useCallback } from "react";

import { cn } from "@anlg/utils";

import { ChatContent } from "./content";
import { ChatSession, type ChatSessionRenderProps } from "./session-provider";
import { ChatToolbarControls } from "./toolbar-controls";
import { useSessionTab } from "./use-session-tab";

import { useLanguageModel } from "~/ai/hooks";
import { useChatAppearance } from "~/chat/hooks/use-chat-appearance";
import { useChatActions } from "~/chat/store/use-chat-actions";
import { chatFloatingPanelClassNames } from "~/chat/surface";
import { useShell } from "~/contexts/shell";
import { useSessionHasTranscript } from "~/session/queries";
import { useOwnerUserId } from "~/shared/owner-user";
import { isBatchTranscriptionPending } from "~/store/zustand/listener/general-shared";
import { useListener } from "~/stt/contexts";

export function ChatView({
  layout = "floating",
  onOpenFloating,
  onOpenRightPanel,
}: {
  layout?: "floating" | "right-panel" | "inline";
  onOpenFloating?: () => void;
  onOpenRightPanel?: () => void;
}) {
  return (
    <ChatSessionHost>
      {(sessionProps) => (
        <ChatPanelFrame
          layout={layout}
          onOpenFloating={onOpenFloating}
          onOpenRightPanel={onOpenRightPanel}
          sessionProps={sessionProps}
        />
      )}
    </ChatSessionHost>
  );
}

export function ChatSessionHost({
  children,
}: {
  children: (sessionProps: ChatSessionRenderProps | null) => ReactNode;
}) {
  const { chat } = useShell();
  const { groupId, sessionId } = chat;
  const { currentSessionId } = useSessionTab();
  const liveSessionId = useListener((state) => state.live.sessionId);
  const isLiveAsk = useListener((state) => {
    if (chat.scope !== "general") {
      return false;
    }
    const sessionId = state.live.sessionId ?? currentSessionId;
    if (!sessionId) {
      return false;
    }
    return state.getSessionMode(sessionId) === "active";
  });
  const contextSessionId =
    chat.scope === "automations"
      ? undefined
      : isLiveAsk
        ? (liveSessionId ?? currentSessionId)
        : currentSessionId;
  const ownerUserId = useOwnerUserId();
  const hasAvailableTranscript = useSessionHasTranscript(
    contextSessionId ?? "",
  );
  const batchTranscriptionPending = useListener((state) => {
    if (chat.scope !== "general" || !contextSessionId) {
      return false;
    }
    return isBatchTranscriptionPending(
      state.getSessionMode(contextSessionId),
      state.live,
      state.live.batchTranscriptionPendingBySession[contextSessionId],
    );
  });

  if (!ownerUserId) {
    return <>{children(null)}</>;
  }

  return (
    <ChatSession
      sessionId={sessionId}
      chatGroupId={groupId}
      currentSessionId={contextSessionId}
      hasAvailableTranscript={hasAvailableTranscript}
      isBatchTranscriptionPending={batchTranscriptionPending}
      isLiveAsk={isLiveAsk}
      unstyled
    >
      {children}
    </ChatSession>
  );
}

export function ChatPanelFrame({
  layout = "floating",
  onDraftContentChange,
  onOpenFloating,
  onOpenRightPanel,
  sessionProps,
}: {
  layout?: "floating" | "right-panel" | "inline";
  onDraftContentChange?: (hasDraftContent: boolean) => void;
  onOpenFloating?: () => void;
  onOpenRightPanel?: () => void;
  sessionProps: ChatSessionRenderProps | null;
}) {
  const { chat } = useShell();
  const { groupId, setGroupId, rollbackFailedGroup } = chat;
  const { currentSessionId } = useSessionTab();
  const { panelClassName, toolbarSurface } = useChatAppearance();
  const isFloating = layout === "floating";
  const isInline = layout === "inline";
  const model = useLanguageModel("chat");

  const handleGroupCreated = useCallback(
    (newGroupId: string) => {
      setGroupId(newGroupId);
    },
    [setGroupId],
  );

  const handleGroupCreateFailed = useCallback(
    (failedGroupId: string) => {
      rollbackFailedGroup(failedGroupId);
    },
    [rollbackFailedGroup],
  );

  const { handleSendMessage } = useChatActions({
    chatScope: chat.scope,
    groupId,
    onGroupCreated: handleGroupCreated,
    onGroupCreateFailed: handleGroupCreateFailed,
  });

  return (
    <div
      className={cn([
        "flex min-h-0 flex-col overflow-hidden",
        isInline
          ? "h-auto max-h-[22rem]"
          : isFloating
            ? "max-h-full"
            : "h-full",
        isFloating
          ? chatFloatingPanelClassNames()
          : isInline
            ? null
            : panelClassName,
      ])}
    >
      {chat.scope === "automations" || isInline ? null : (
        <div
          data-tauri-drag-region={!isFloating || undefined}
          className={cn([
            "flex shrink-0 pr-0 pl-0",
            isFloating ? "h-11 items-center" : "h-9 items-start pt-[9px]",
          ])}
        >
          <ChatToolbarControls
            chatScope={chat.scope}
            currentChatGroupId={groupId}
            isolateConversation={chat.isolateConversation}
            layout={layout}
            pinned={chat.isRecording}
            showMeetingAskSwitch={
              chat.workspaceAsk &&
              Boolean(currentSessionId) &&
              !chat.isRecording
            }
            showWorkspaceAskSwitch={
              chat.isolateConversation && !chat.isRecording
            }
            onClose={() => chat.sendEvent({ type: "CLOSE" })}
            onNewChat={chat.startNewChat}
            onOpenFloating={onOpenFloating}
            onOpenMeetingAsk={chat.openMeetingAsk}
            onOpenRightPanel={onOpenRightPanel}
            onOpenWorkspaceAsk={chat.openWorkspaceAsk}
            onSelectChat={chat.selectChat}
            surface={toolbarSurface}
          />
        </div>
      )}
      {sessionProps && (
        <ChatContent
          {...sessionProps}
          layout={layout}
          onDraftContentChange={onDraftContentChange}
          model={model}
          handleSendMessage={handleSendMessage}
          isRecording={chat.isRecording}
          isBatchOnly={chat.isBatchOnly}
        />
      )}
    </div>
  );
}
