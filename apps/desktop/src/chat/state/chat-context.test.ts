import { beforeEach, describe, expect, test } from "vitest";

import { getMeetingChatId, useChatContext } from "./chat-context";

describe("chat context", () => {
  beforeEach(() => {
    useChatContext.setState({
      chatByScope: {
        general: { groupId: undefined, sessionId: "general-initial" },
        automations: {
          groupId: undefined,
          sessionId: "automations-initial",
        },
      },
      chatByMeetingId: {},
      workspaceAsk: false,
    });
  });

  test("startNewChat resets the group and rotates the session id", () => {
    useChatContext.setState({
      chatByScope: {
        ...useChatContext.getState().chatByScope,
        general: { groupId: "group-1", sessionId: "session-1" },
      },
    });

    useChatContext.getState().startNewChat("general");

    const selection = useChatContext.getState().chatByScope.general;
    expect(selection.groupId).toBeUndefined();
    expect(selection.sessionId).not.toBe("session-1");
  });

  test("selectChat syncs the selected group and session id", () => {
    useChatContext.getState().selectChat("general", "group-2");

    const selection = useChatContext.getState().chatByScope.general;
    expect(selection.groupId).toBe("group-2");
    expect(selection.sessionId).toBe("group-2");
  });

  test("keeps general and automation conversations separate", () => {
    useChatContext.getState().selectChat("general", "general-group");
    useChatContext.getState().selectChat("automations", "automation-group");

    const state = useChatContext.getState();
    expect(state.chatByScope.general).toEqual({
      groupId: "general-group",
      sessionId: "general-group",
    });
    expect(state.chatByScope.automations).toEqual({
      groupId: "automation-group",
      sessionId: "automation-group",
    });
  });

  test("keeps a fresh conversation per meeting without touching general chat", () => {
    useChatContext.getState().selectChat("general", "general-group");
    useChatContext.getState().ensureMeetingChat("meeting-1");
    useChatContext.getState().setMeetingGroupId("meeting-1", "meeting-1-group");
    useChatContext.getState().ensureMeetingChat("meeting-2");

    const state = useChatContext.getState();
    expect(state.chatByScope.general).toEqual({
      groupId: "general-group",
      sessionId: "general-group",
    });
    expect(state.chatByMeetingId["meeting-1"]).toEqual({
      groupId: "meeting-1-group",
      sessionId: "meeting:meeting-1",
    });
    expect(state.chatByMeetingId["meeting-2"]).toEqual({
      groupId: undefined,
      sessionId: "meeting:meeting-2",
    });
  });

  test("startNewMeetingChat resets only that meeting", () => {
    useChatContext.getState().selectChat("general", "general-group");
    useChatContext.getState().setMeetingGroupId("meeting-1", "meeting-1-group");

    useChatContext.getState().startNewMeetingChat("meeting-1");

    const state = useChatContext.getState();
    expect(state.chatByScope.general.groupId).toBe("general-group");
    expect(state.chatByMeetingId["meeting-1"]?.groupId).toBeUndefined();
    expect(state.chatByMeetingId["meeting-1"]?.sessionId).not.toBe(
      "meeting:meeting-1",
    );
  });
});

describe("getMeetingChatId", () => {
  test("uses the live meeting while recording", () => {
    expect(
      getMeetingChatId({
        scope: "general",
        isRecording: true,
        liveSessionId: "live-1",
        currentSessionId: "tab-1",
      }),
    ).toBe("live-1");
  });

  test("uses the open meeting tab after the call", () => {
    expect(
      getMeetingChatId({
        scope: "general",
        isRecording: false,
        liveSessionId: null,
        currentSessionId: "tab-1",
      }),
    ).toBe("tab-1");
  });

  test("stays on general chat off a meeting", () => {
    expect(
      getMeetingChatId({
        scope: "general",
        isRecording: false,
        liveSessionId: null,
        currentSessionId: undefined,
      }),
    ).toBeUndefined();
  });

  test("keeps general chat while asking across meetings from a note", () => {
    expect(
      getMeetingChatId({
        scope: "general",
        isRecording: false,
        liveSessionId: null,
        currentSessionId: "tab-1",
        workspaceAsk: true,
      }),
    ).toBeUndefined();
  });

  test("still isolates the live meeting while recording", () => {
    expect(
      getMeetingChatId({
        scope: "general",
        isRecording: true,
        liveSessionId: "live-1",
        currentSessionId: "tab-1",
        workspaceAsk: true,
      }),
    ).toBe("live-1");
  });
});
