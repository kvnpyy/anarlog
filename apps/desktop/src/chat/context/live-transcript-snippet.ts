import type { LiveTranscriptSegment } from "@anlg/plugin-transcription";

import type { SessionMode } from "~/store/zustand/listener";
import { listenerStore } from "~/store/zustand/listener/instance";
import { SegmentKeyUtils, SpeakerLabelManager } from "~/stt/live-segment";

export const LIVE_ASK_TRANSCRIPT_WINDOW_MS = 10 * 60 * 1000;

export function formatRecentLiveTranscript({
  liveCaptionText,
  liveSegments,
  liveSessionId,
  liveTranscriptionActive,
  seconds,
  sessionId,
  sessionMode,
  windowMs = LIVE_ASK_TRANSCRIPT_WINDOW_MS,
}: {
  liveCaptionText: string;
  liveSegments: LiveTranscriptSegment[];
  liveSessionId: string | null;
  liveTranscriptionActive: boolean | null;
  seconds: number;
  sessionId: string;
  sessionMode: SessionMode;
  windowMs?: number;
}): string | null {
  if (
    liveSessionId !== sessionId ||
    (sessionMode !== "active" && sessionMode !== "finalizing") ||
    liveTranscriptionActive !== true
  ) {
    return null;
  }

  const windowStartMs = Math.max(0, seconds * 1000 - windowMs);
  const recentSegments = liveSegments
    .filter((segment) => segment.end_ms >= windowStartMs && segment.text.trim())
    .sort((left, right) => left.start_ms - right.start_ms);

  const body =
    recentSegments.length > 0
      ? formatLiveSegments(recentSegments)
      : liveCaptionText.trim();

  if (!body) {
    return null;
  }

  return `IN-PROGRESS TRANSCRIPT (last 10 minutes):\n${body}`;
}

export function getRecentLiveTranscriptContext(
  sessionId: string,
): string | null {
  const state = listenerStore.getState();
  return formatRecentLiveTranscript({
    liveCaptionText: state.liveCaptionText,
    liveSegments: state.liveSegments,
    liveSessionId: state.live.sessionId,
    liveTranscriptionActive: state.live.liveTranscriptionActive,
    seconds: state.live.seconds,
    sessionId,
    sessionMode: state.getSessionMode(sessionId),
  });
}

function formatLiveSegments(segments: LiveTranscriptSegment[]) {
  const manager = SpeakerLabelManager.fromSegments(segments);
  return segments
    .map((segment) => {
      const speaker = SegmentKeyUtils.renderLabel(
        segment.key,
        undefined,
        manager,
      );
      return `${speaker}: ${segment.text.trim()}`;
    })
    .join("\n");
}
