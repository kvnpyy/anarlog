import type { LiveTranscriptSegment } from "@anlg/plugin-transcription";

import type { SessionMode } from "~/store/zustand/listener";
import { listenerStore } from "~/store/zustand/listener/instance";
import {
  type RenderLabelContext,
  SegmentKeyUtils,
  SpeakerLabelManager,
} from "~/stt/live-segment";

export const LIVE_ASK_CATCH_UP_WINDOW_MS = 5 * 60 * 1000;
export const LIVE_ASK_TRANSCRIPT_WINDOW_MS = 10 * 60 * 1000;
export const LIVE_ASK_TRANSCRIPT_MAX_CHARS = 24_000;
export const LIVE_TRANSCRIPT_CONTEXT_HEADER = "IN-PROGRESS TRANSCRIPT:";
export const LIVE_TRANSCRIPT_SPEAKER_LEGEND =
  'Labels: "You" is the person using Acorn (microphone). Other speakers are everyone else.';
export const LIVE_TRANSCRIPT_UNLABELED_CAPTION =
  'Unlabeled live caption (speaker unknown). Do not treat this as "You".';
export const LIVE_TRANSCRIPT_SILENT_USER_NOTE =
  'There are no "You:" lines in this window. The Acorn user has been silent. Do not write as if they spoke, asked, presented, or led.';

const LIVE_ASK_SELF_LABEL_CONTEXT: RenderLabelContext = {
  getSelfHumanId: () => "self",
  getHumanName: () => undefined,
};

export function formatRecentLiveTranscript({
  liveCaptionText,
  liveSegments,
  liveSessionId,
  liveTranscriptionActive,
  seconds,
  sessionId,
  sessionMode,
  maxChars = LIVE_ASK_TRANSCRIPT_MAX_CHARS,
  windowMs,
}: {
  liveCaptionText: string;
  liveSegments: LiveTranscriptSegment[];
  liveSessionId: string | null;
  liveTranscriptionActive: boolean | null;
  seconds: number;
  sessionId: string;
  sessionMode: SessionMode;
  maxChars?: number;
  windowMs?: number;
}): string | null {
  if (
    liveSessionId !== sessionId ||
    (sessionMode !== "active" && sessionMode !== "finalizing") ||
    liveTranscriptionActive !== true
  ) {
    return null;
  }

  const windowStartMs =
    windowMs == null ? 0 : Math.max(0, seconds * 1000 - windowMs);
  const recentSegments = liveSegments
    .filter((segment) => segment.end_ms >= windowStartMs && segment.text.trim())
    .sort((left, right) => left.start_ms - right.start_ms);

  let body: string;
  let userSpoke = false;
  if (recentSegments.length > 0) {
    const formatted = formatLiveSegments(recentSegments);
    userSpoke = transcriptHasYouLines(formatted);
    body = trimTranscriptBody(formatted, maxChars);
  } else {
    const caption = liveCaptionText.trim();
    body = caption
      ? `${LIVE_TRANSCRIPT_UNLABELED_CAPTION}\n${trimTranscriptBody(caption, maxChars)}`
      : "";
  }

  if (!body) {
    return null;
  }

  const silentNote =
    recentSegments.length > 0 && !userSpoke
      ? LIVE_TRANSCRIPT_SILENT_USER_NOTE
      : null;

  return [
    LIVE_TRANSCRIPT_CONTEXT_HEADER,
    LIVE_TRANSCRIPT_SPEAKER_LEGEND,
    body,
    silentNote,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function getRecentLiveTranscriptContext(
  sessionId: string,
  windowMs?: number,
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
    windowMs,
  });
}

function transcriptHasYouLines(body: string): boolean {
  return body.split("\n").some((line) => line.startsWith("You: "));
}

function formatLiveSegments(segments: LiveTranscriptSegment[]) {
  const manager = SpeakerLabelManager.fromSegments(
    segments,
    LIVE_ASK_SELF_LABEL_CONTEXT,
  );
  return segments
    .map((segment) => {
      const speaker =
        segment.key.channel === "DirectMic"
          ? "You"
          : SegmentKeyUtils.renderLabel(
              segment.key,
              LIVE_ASK_SELF_LABEL_CONTEXT,
              manager,
            );
      return `${speaker}: ${segment.text.trim()}`;
    })
    .join("\n");
}

function trimTranscriptBody(body: string, maxChars: number): string {
  if (body.length <= maxChars) {
    return body;
  }

  const lines = body.split("\n");
  const kept: string[] = [];
  let size = 0;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    const extra = line.length + (kept.length > 0 ? 1 : 0);
    if (size + extra > maxChars && kept.length > 0) {
      break;
    }
    kept.unshift(line);
    size += extra;
  }

  return kept.join("\n");
}
