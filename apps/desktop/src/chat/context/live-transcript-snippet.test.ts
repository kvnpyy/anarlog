import { describe, expect, it } from "vitest";

import type { LiveTranscriptSegment } from "@anlg/plugin-transcription";

import { formatRecentLiveTranscript } from "./live-transcript-snippet";

function segment(
  overrides: Partial<LiveTranscriptSegment> &
    Pick<LiveTranscriptSegment, "id" | "text" | "start_ms" | "end_ms">,
): LiveTranscriptSegment {
  return {
    key: {
      channel: "RemoteParty",
      speaker_index: 0,
      speaker_human_id: null,
    },
    words: [],
    ...overrides,
  };
}

describe("formatRecentLiveTranscript", () => {
  it("returns the last 10 minutes of in-progress live segments", () => {
    const text = formatRecentLiveTranscript({
      liveCaptionText: "",
      liveSegments: [
        segment({
          id: "old",
          text: "Too old",
          start_ms: 0,
          end_ms: 60_000,
        }),
        segment({
          id: "recent",
          text: "Just said this",
          start_ms: 11 * 60_000,
          end_ms: 11 * 60_000 + 2_000,
          key: {
            channel: "DirectMic",
            speaker_index: null,
            speaker_human_id: null,
          },
        }),
      ],
      liveSessionId: "session-1",
      liveTranscriptionActive: true,
      seconds: 12 * 60,
      sessionId: "session-1",
      sessionMode: "active",
    });

    expect(text).toContain("IN-PROGRESS TRANSCRIPT (last 10 minutes):");
    expect(text).toContain("Just said this");
    expect(text).not.toContain("Too old");
  });

  it("falls back to live caption text when segments are empty", () => {
    const text = formatRecentLiveTranscript({
      liveCaptionText: "Partial caption so far",
      liveSegments: [],
      liveSessionId: "session-1",
      liveTranscriptionActive: true,
      seconds: 30,
      sessionId: "session-1",
      sessionMode: "active",
    });

    expect(text).toBe(
      "IN-PROGRESS TRANSCRIPT (last 10 minutes):\nPartial caption so far",
    );
  });

  it("returns null when live transcription is not active", () => {
    expect(
      formatRecentLiveTranscript({
        liveCaptionText: "Should not leak",
        liveSegments: [
          segment({
            id: "live",
            text: "Should not leak",
            start_ms: 0,
            end_ms: 1_000,
          }),
        ],
        liveSessionId: "session-1",
        liveTranscriptionActive: false,
        seconds: 30,
        sessionId: "session-1",
        sessionMode: "active",
      }),
    ).toBeNull();
  });

  it("returns null for a different session", () => {
    expect(
      formatRecentLiveTranscript({
        liveCaptionText: "",
        liveSegments: [
          segment({
            id: "live",
            text: "Other meeting",
            start_ms: 0,
            end_ms: 1_000,
          }),
        ],
        liveSessionId: "session-a",
        liveTranscriptionActive: true,
        seconds: 30,
        sessionId: "session-b",
        sessionMode: "inactive",
      }),
    ).toBeNull();
  });
});
