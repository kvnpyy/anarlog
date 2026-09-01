import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatScope } from "~/chat/types";
import type { ChatEvent, ChatMode } from "~/store/zustand/tabs";

const mocks = vi.hoisted(() => ({
  chatMode: "FloatingClosed" as ChatMode,
  currentSessionId: "session-1" as string | undefined,
  currentTabType: "sessions" as string,
  isBatchOnly: false,
  isRecording: false,
  transitionChatMode: vi.fn(),
  useHotkeys: vi.fn(),
}));

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: mocks.useHotkeys,
}));

vi.mock("./chat-context", () => ({
  createMeetingChatSelection: (meetingId: string) => ({
    groupId: undefined,
    sessionId: `meeting:${meetingId}`,
  }),
  getMeetingChatId: ({
    scope,
    isRecording,
    liveSessionId,
    currentSessionId,
  }: {
    scope: ChatScope;
    isRecording: boolean;
    liveSessionId: string | null;
    currentSessionId: string | undefined;
  }) => {
    if (scope !== "general") {
      return undefined;
    }
    if (isRecording) {
      return liveSessionId ?? currentSessionId ?? undefined;
    }
    return currentSessionId;
  },
  useChatContext: (
    selector: (state: {
      chatByScope: Record<
        ChatScope,
        { groupId: string | undefined; sessionId: string }
      >;
      chatByMeetingId: Record<
        string,
        { groupId: string | undefined; sessionId: string }
      >;
      ensureMeetingChat: (meetingId: string) => void;
      setGroupId: () => void;
      rollbackFailedGroup: () => void;
      startNewChat: () => void;
      selectChat: () => void;
      setMeetingGroupId: () => void;
      rollbackFailedMeetingGroup: () => void;
      startNewMeetingChat: () => void;
      selectMeetingChat: () => void;
    }) => unknown,
  ) =>
    selector({
      chatByScope: {
        general: { groupId: undefined, sessionId: "chat-session" },
        automations: { groupId: undefined, sessionId: "automation-session" },
      },
      chatByMeetingId: {},
      ensureMeetingChat: vi.fn(),
      setGroupId: vi.fn(),
      rollbackFailedGroup: vi.fn(),
      startNewChat: vi.fn(),
      selectChat: vi.fn(),
      setMeetingGroupId: vi.fn(),
      rollbackFailedMeetingGroup: vi.fn(),
      startNewMeetingChat: vi.fn(),
      selectMeetingChat: vi.fn(),
    }),
}));

vi.mock("~/chat/components/use-session-tab", () => ({
  useSessionTab: () => ({ currentSessionId: mocks.currentSessionId }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (
    selector: (state: {
      chatMode: ChatMode;
      currentTab: { type: string; id?: string } | null;
      transitionChatMode: (event: ChatEvent) => void;
    }) => unknown,
  ) =>
    selector({
      chatMode: mocks.chatMode,
      currentTab: { type: mocks.currentTabType, id: mocks.currentSessionId },
      transitionChatMode: mocks.transitionChatMode,
    }),
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (
    selector: (state: {
      getSessionMode: (sessionId: string) => string;
      live: {
        sessionId: string | null;
        requestedLiveTranscription: boolean | null;
        liveTranscriptionActive: boolean | null;
        batchTranscriptionPendingBySession: Record<string, boolean>;
      };
    }) => unknown,
  ) =>
    selector({
      getSessionMode: () => (mocks.isRecording ? "active" : "inactive"),
      live: {
        sessionId: mocks.isRecording ? "session-1" : null,
        requestedLiveTranscription: mocks.isBatchOnly ? false : true,
        liveTranscriptionActive: mocks.isBatchOnly ? false : true,
        batchTranscriptionPendingBySession: {},
      },
    }),
}));

import { useChatMode } from "./use-chat-mode";

describe("useChatMode", () => {
  beforeEach(() => {
    mocks.chatMode = "FloatingClosed";
    mocks.currentSessionId = "session-1";
    mocks.currentTabType = "sessions";
    mocks.isBatchOnly = false;
    mocks.isRecording = false;
    mocks.transitionChatMode.mockClear();
    mocks.useHotkeys.mockClear();
  });

  it("does not open a right-panel Ask column when recording off the note", () => {
    mocks.currentSessionId = undefined;
    mocks.currentTabType = "empty";
    mocks.isRecording = true;

    const { result } = renderHook(() => useChatMode());

    expect(mocks.transitionChatMode).not.toHaveBeenCalled();
    expect(result.current.inlineAsk).toBe(false);
  });

  it("keeps Ask in the meeting column instead of opening a right panel", () => {
    mocks.isRecording = true;

    const { result } = renderHook(() => useChatMode());

    expect(mocks.transitionChatMode).not.toHaveBeenCalled();
    expect(result.current.inlineAsk).toBe(true);
  });

  it("closes a docked or floating chat when Ask is inline on the meeting", () => {
    mocks.chatMode = "RightPanelOpen";
    mocks.isRecording = true;

    renderHook(() => useChatMode());

    expect(mocks.transitionChatMode).toHaveBeenCalledWith({
      type: "CLOSE",
    });
  });

  it("ignores close and float events while Ask is inline on the meeting", () => {
    mocks.isRecording = true;

    const { result } = renderHook(() => useChatMode());

    result.current.sendEvent({ type: "CLOSE" });
    result.current.sendEvent({ type: "TOGGLE" });
    result.current.sendEvent({ type: "OPEN" });
    result.current.sendEvent({ type: "OPEN_RIGHT_PANEL" });

    expect(mocks.transitionChatMode).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
    expect(result.current.inlineAsk).toBe(true);
  });

  it("marks batch-only live capture so Ask can warn", () => {
    mocks.isRecording = true;
    mocks.isBatchOnly = true;

    const { result } = renderHook(() => useChatMode());

    expect(result.current.isRecording).toBe(true);
    expect(result.current.isBatchOnly).toBe(true);
  });

  it("isolates a meeting conversation from general chat history", () => {
    const { result } = renderHook(() => useChatMode());

    expect(result.current.isolateConversation).toBe(true);
    expect(result.current.sessionId).toBe("meeting:session-1");
    expect(result.current.groupId).toBeUndefined();
  });

  it("keeps general chat when no meeting is open", () => {
    mocks.currentSessionId = undefined;
    mocks.currentTabType = "empty";

    const { result } = renderHook(() => useChatMode());

    expect(result.current.isolateConversation).toBe(false);
    expect(result.current.sessionId).toBe("chat-session");
  });
});
