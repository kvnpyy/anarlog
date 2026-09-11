import { describe, expect, it } from "vitest";

import type { LiveTranscriptSegment } from "@anlg/plugin-transcription";

import {
  LIVE_ASK_TRANSCRIPT_WINDOW_MS,
  formatRecentLiveTranscript,
} from "./live-transcript-snippet";

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
  it("includes earlier in-progress live segments, not only the last 10 minutes", () => {
    const text = formatRecentLiveTranscript({
      liveCaptionText: "",
      liveSegments: [
        segment({
          id: "old",
          text: "Kickoff from the start",
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

    expect(text).toContain("IN-PROGRESS TRANSCRIPT:");
    expect(text).not.toContain("last 10 minutes");
    expect(text).toContain("Kickoff from the start");
    expect(text).toContain("Just said this");
    expect(text).toContain('Labels: "You" is the person using Acorn');
    expect(text).toContain("You: Just said this");
    expect(text).toContain("Speaker 1: Kickoff from the start");
  });

  it("can still window to the last 10 minutes when asked", () => {
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
      windowMs: LIVE_ASK_TRANSCRIPT_WINDOW_MS,
    });

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
      'IN-PROGRESS TRANSCRIPT:\nLabels: "You" is the person using Acorn (microphone). Other speakers are everyone else.\nPartial caption so far',
    );
  });

  it("keeps the newest speaker lines when the transcript exceeds the char budget", () => {
    const text = formatRecentLiveTranscript({
      liveCaptionText: "",
      liveSegments: [
        segment({
          id: "old",
          text: "aaaaaaaaaa",
          start_ms: 0,
          end_ms: 1_000,
        }),
        segment({
          id: "new",
          text: "bbbbbbbbbb",
          start_ms: 2_000,
          end_ms: 3_000,
        }),
      ],
      liveSessionId: "session-1",
      liveTranscriptionActive: true,
      seconds: 30,
      sessionId: "session-1",
      sessionMode: "active",
      maxChars: 20,
    });

    expect(text).toContain("IN-PROGRESS TRANSCRIPT:");
    expect(text).toContain("bbbbbbbbbb");
    expect(text).not.toContain("aaaaaaaaaa");
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

  it("labels the microphone as You and the other party as a speaker", () => {
    const text = formatRecentLiveTranscript({
      liveCaptionText: "",
      liveSegments: [
        segment({
          id: "customer",
          text: "What does pricing look like?",
          start_ms: 0,
          end_ms: 1_000,
        }),
        segment({
          id: "rep",
          text: "I can walk you through that.",
          start_ms: 2_000,
          end_ms: 3_000,
          key: {
            channel: "DirectMic",
            speaker_index: null,
            speaker_human_id: null,
          },
        }),
      ],
      liveSessionId: "session-1",
      liveTranscriptionActive: true,
      seconds: 30,
      sessionId: "session-1",
      sessionMode: "active",
    });

    expect(text).toContain("You: I can walk you through that.");
    expect(text).toContain("Speaker 1: What does pricing look like?");
    expect(text).not.toMatch(/Speaker \d+: I can walk you through that/);
  });
});
