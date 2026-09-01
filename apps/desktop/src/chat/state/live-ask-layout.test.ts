import { describe, expect, it } from "vitest";

import { shouldInlineLiveAsk } from "./live-ask-layout";

describe("shouldInlineLiveAsk", () => {
  it("docks Ask in the meeting column while that meeting is recording", () => {
    expect(
      shouldInlineLiveAsk({
        isRecording: true,
        liveSessionId: "meeting-1",
        currentTab: { type: "sessions", id: "meeting-1" },
      }),
    ).toBe(true);
  });

  it("stays out of the column on calendar or another note", () => {
    expect(
      shouldInlineLiveAsk({
        isRecording: true,
        liveSessionId: "meeting-1",
        currentTab: { type: "empty" },
      }),
    ).toBe(false);
    expect(
      shouldInlineLiveAsk({
        isRecording: true,
        liveSessionId: "meeting-1",
        currentTab: { type: "sessions", id: "meeting-2" },
      }),
    ).toBe(false);
  });

  it("is off when nothing is recording", () => {
    expect(
      shouldInlineLiveAsk({
        isRecording: false,
        liveSessionId: "meeting-1",
        currentTab: { type: "sessions", id: "meeting-1" },
      }),
    ).toBe(false);
  });
});
