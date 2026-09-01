import { useCallback, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  createMeetingChatSelection,
  getMeetingChatId,
  useChatContext,
} from "./chat-context";
import { shouldInlineLiveAsk } from "./live-ask-layout";

import { useSessionTab } from "~/chat/components/use-session-tab";
import type { ChatScope } from "~/chat/types";
import { isBatchTranscriptionPending } from "~/store/zustand/listener/general-shared";
import { type ChatEvent, useTabs } from "~/store/zustand/tabs";
import { useListener } from "~/stt/contexts";

export type { ChatEvent, ChatMode } from "~/store/zustand/tabs";

export function useChatMode() {
  const mode = useTabs((state) => state.chatMode);
  const transitionChatMode = useTabs((state) => state.transitionChatMode);
  const currentTab = useTabs((state) => state.currentTab);
  const scope: ChatScope =
    currentTab?.type === "automations" ? "automations" : "general";
  const { currentSessionId } = useSessionTab();
  const liveSessionId = useListener((state) => state.live.sessionId);
  const isRecording = useListener((state) => {
    if (scope !== "general") {
      return false;
    }
    const sessionId = state.live.sessionId ?? currentSessionId;
    if (!sessionId) {
      return false;
    }
    return state.getSessionMode(sessionId) === "active";
  });
  const isBatchOnly = useListener((state) => {
    if (scope !== "general") {
      return false;
    }
    const sessionId = state.live.sessionId ?? currentSessionId;
    if (!sessionId) {
      return false;
    }
    const sessionMode = state.getSessionMode(sessionId);
    return (
      sessionMode === "active" &&
      isBatchTranscriptionPending(
        sessionMode,
        state.live,
        state.live.batchTranscriptionPendingBySession[sessionId],
      )
    );
  });
  const meetingChatId = getMeetingChatId({
    scope,
    isRecording,
    liveSessionId,
    currentSessionId,
  });

  const selection = useChatContext((state) => {
    if (meetingChatId) {
      return (
        state.chatByMeetingId[meetingChatId] ??
        createMeetingChatSelection(meetingChatId)
      );
    }

    return state.chatByScope[scope];
  });
  const ensureMeetingChat = useChatContext((state) => state.ensureMeetingChat);
  const setScopedGroupId = useChatContext((state) => state.setGroupId);
  const rollbackFailedScopedGroup = useChatContext(
    (state) => state.rollbackFailedGroup,
  );
  const startNewScopedChat = useChatContext((state) => state.startNewChat);
  const selectScopedChat = useChatContext((state) => state.selectChat);
  const setMeetingGroupId = useChatContext((state) => state.setMeetingGroupId);
  const rollbackFailedMeetingGroup = useChatContext(
    (state) => state.rollbackFailedMeetingGroup,
  );
  const startNewMeetingChat = useChatContext(
    (state) => state.startNewMeetingChat,
  );
  const selectMeetingChat = useChatContext((state) => state.selectMeetingChat);

  useEffect(() => {
    if (meetingChatId) {
      ensureMeetingChat(meetingChatId);
    }
  }, [ensureMeetingChat, meetingChatId]);

  const setGroupId = useCallback(
    (groupId: string | undefined) => {
      if (meetingChatId) {
        setMeetingGroupId(meetingChatId, groupId);
        return;
      }

      setScopedGroupId(scope, groupId);
    },
    [meetingChatId, scope, setMeetingGroupId, setScopedGroupId],
  );
  const rollbackFailedGroup = useCallback(
    (failedGroupId: string) => {
      if (meetingChatId) {
        rollbackFailedMeetingGroup(meetingChatId, failedGroupId);
        return;
      }

      rollbackFailedScopedGroup(scope, failedGroupId);
    },
    [
      meetingChatId,
      rollbackFailedMeetingGroup,
      rollbackFailedScopedGroup,
      scope,
    ],
  );
  const startNewChat = useCallback(() => {
    if (meetingChatId) {
      startNewMeetingChat(meetingChatId);
      return;
    }

    startNewScopedChat(scope);
  }, [meetingChatId, scope, startNewMeetingChat, startNewScopedChat]);
  const selectChat = useCallback(
    (groupId: string) => {
      if (meetingChatId) {
        selectMeetingChat(meetingChatId, groupId);
        return;
      }

      selectScopedChat(scope, groupId);
    },
    [meetingChatId, scope, selectMeetingChat, selectScopedChat],
  );

  const inlineAsk = shouldInlineLiveAsk({
    isRecording,
    liveSessionId,
    currentTab,
  });

  const sendEvent = useCallback(
    (event: ChatEvent) => {
      if (
        inlineAsk &&
        (event.type === "CLOSE" ||
          event.type === "TOGGLE" ||
          event.type === "OPEN" ||
          event.type === "OPEN_RIGHT_PANEL")
      ) {
        return;
      }

      transitionChatMode(event);
    },
    [inlineAsk, transitionChatMode],
  );

  useEffect(() => {
    if (!inlineAsk) {
      return;
    }

    if (mode === "RightPanelOpen" || mode === "FloatingOpen") {
      transitionChatMode({ type: "CLOSE" });
    }
  }, [inlineAsk, mode, transitionChatMode]);

  useHotkeys(
    "mod+j",
    () => {
      sendEvent({ type: "TOGGLE" });
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [sendEvent],
  );

  return {
    mode,
    scope,
    sendEvent,
    isRecording,
    isBatchOnly,
    inlineAsk,
    isolateConversation: Boolean(meetingChatId),
    groupId: selection.groupId,
    sessionId: selection.sessionId,
    setGroupId,
    rollbackFailedGroup,
    startNewChat,
    selectChat,
  };
}
