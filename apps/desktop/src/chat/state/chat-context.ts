import { create } from "zustand";

import type { ChatScope } from "~/chat/types";
import { id } from "~/shared/utils";

type ChatSelection = {
  groupId: string | undefined;
  sessionId: string;
};

interface ChatContextState {
  chatByScope: Record<ChatScope, ChatSelection>;
  chatByMeetingId: Record<string, ChatSelection>;
  workspaceAsk: boolean;
}

interface ChatContextActions {
  setWorkspaceAsk: (workspaceAsk: boolean) => void;
  setGroupId: (scope: ChatScope, groupId: string | undefined) => void;
  rollbackFailedGroup: (scope: ChatScope, failedGroupId: string) => void;
  startNewChat: (scope: ChatScope) => void;
  selectChat: (scope: ChatScope, groupId: string) => void;
  ensureMeetingChat: (meetingId: string) => void;
  setMeetingGroupId: (meetingId: string, groupId: string | undefined) => void;
  rollbackFailedMeetingGroup: (
    meetingId: string,
    failedGroupId: string,
  ) => void;
  startNewMeetingChat: (meetingId: string) => void;
  selectMeetingChat: (meetingId: string, groupId: string) => void;
}

export const useChatContext = create<ChatContextState & ChatContextActions>(
  (set) => ({
    chatByScope: {
      general: createChatSelection(),
      automations: createChatSelection(),
    },
    chatByMeetingId: {},
    workspaceAsk: false,
    setWorkspaceAsk: (workspaceAsk) => set({ workspaceAsk }),
    setGroupId: (scope, groupId) =>
      set((state) => ({
        chatByScope: {
          ...state.chatByScope,
          [scope]: { ...state.chatByScope[scope], groupId },
        },
      })),
    // Compares against the live groupId, not a value captured when the send
    // started — the failure lands after onGroupCreated already updated it.
    rollbackFailedGroup: (scope, failedGroupId) =>
      set((state) => {
        const selection = state.chatByScope[scope];
        if (selection.groupId !== failedGroupId) {
          return state;
        }

        return {
          chatByScope: {
            ...state.chatByScope,
            [scope]: { ...selection, groupId: undefined },
          },
        };
      }),
    startNewChat: (scope) =>
      set((state) => ({
        chatByScope: {
          ...state.chatByScope,
          [scope]: createChatSelection(),
        },
      })),
    selectChat: (scope, groupId) =>
      set((state) => ({
        chatByScope: {
          ...state.chatByScope,
          [scope]: { groupId, sessionId: groupId },
        },
      })),
    ensureMeetingChat: (meetingId) =>
      set((state) => {
        if (state.chatByMeetingId[meetingId]) {
          return state;
        }

        return {
          chatByMeetingId: {
            ...state.chatByMeetingId,
            [meetingId]: createMeetingChatSelection(meetingId),
          },
        };
      }),
    setMeetingGroupId: (meetingId, groupId) =>
      set((state) => ({
        chatByMeetingId: {
          ...state.chatByMeetingId,
          [meetingId]: {
            ...(state.chatByMeetingId[meetingId] ??
              createMeetingChatSelection(meetingId)),
            groupId,
          },
        },
      })),
    rollbackFailedMeetingGroup: (meetingId, failedGroupId) =>
      set((state) => {
        const selection = state.chatByMeetingId[meetingId];
        if (!selection || selection.groupId !== failedGroupId) {
          return state;
        }

        return {
          chatByMeetingId: {
            ...state.chatByMeetingId,
            [meetingId]: { ...selection, groupId: undefined },
          },
        };
      }),
    startNewMeetingChat: (meetingId) =>
      set((state) => ({
        chatByMeetingId: {
          ...state.chatByMeetingId,
          [meetingId]: createChatSelection(),
        },
      })),
    selectMeetingChat: (meetingId, groupId) =>
      set((state) => ({
        chatByMeetingId: {
          ...state.chatByMeetingId,
          [meetingId]: { groupId, sessionId: groupId },
        },
      })),
  }),
);

export function getMeetingChatId({
  scope,
  isRecording,
  liveSessionId,
  currentSessionId,
  workspaceAsk = false,
}: {
  scope: ChatScope;
  isRecording: boolean;
  liveSessionId: string | null | undefined;
  currentSessionId: string | undefined;
  workspaceAsk?: boolean;
}): string | undefined {
  if (scope !== "general") {
    return undefined;
  }

  if (isRecording) {
    return liveSessionId ?? currentSessionId ?? undefined;
  }

  if (workspaceAsk) {
    return undefined;
  }

  return currentSessionId;
}

export function createMeetingChatSelection(meetingId: string): ChatSelection {
  return { groupId: undefined, sessionId: `meeting:${meetingId}` };
}

function createChatSelection(): ChatSelection {
  return { groupId: undefined, sessionId: id() };
}
