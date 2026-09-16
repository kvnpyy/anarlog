import { t } from "@lingui/core/macro";
import {
  ClockCounterClockwise,
  Envelope,
  Lightning,
  ListChecks,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useCallback } from "react";

import { cn } from "@anlg/utils";

import type { ContextRef } from "~/chat/context/entities";
import {
  LIVE_ASK_CATCH_UP_WINDOW_MS,
  LIVE_ASK_TRANSCRIPT_WINDOW_MS,
} from "~/chat/context/live-transcript-snippet";

export function LiveAskRail({
  isBatchOnly,
  onSendMessage,
  showRecipes = true,
  variant = "live",
}: {
  isBatchOnly: boolean;
  onSendMessage?: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
    contextRefs?: ContextRef[],
    modelPrompt?: string,
    transcriptWindowMs?: number,
  ) => void;
  showRecipes?: boolean;
  variant?: "live" | "past";
}) {
  const recipes =
    variant === "past"
      ? [
          {
            label: t`Draft email`,
            icon: Envelope,
            prompt: t`Draft a follow-up email from me to the other people on this call. I am the sender: write in first person as me, never refer to me in the third person, and do not write the other company's internal recap. Write it in my voice — how I actually talk — and skip generic AI phrasing. Keep the whole email under 250 words unless I ask for a longer recap. Start with a Subject line, then a blank line, then the body. Use short paragraphs and bullet points when they help scanning. Light markdown is OK: bullets, numbered lists, and bold. Do not use headings, tables, or code fences.`,
          },
          {
            label: t`Action items`,
            icon: ListChecks,
            prompt: t`What are my action items from this meeting? Include anything I committed to and anything I need to chase. Keep it as a short checklist.`,
          },
          {
            label: t`Key decisions`,
            icon: MagnifyingGlass,
            prompt: t`What were the key decisions from this meeting? For each one, note who owned it and any deadline if it was said.`,
          },
        ]
      : [
          {
            label: t`Catch me up`,
            icon: ClockCounterClockwise,
            prompt: t`Catch me up on this meeting. Using only the last 5 minutes of the in-progress transcript, recap what just happened in 3-5 short bullets. Attribute speech only from labels: "You:" is the Acorn user's microphone; any other label is someone else. If there is no "You:" line, the user has been silent — do not write as if they spoke. End with at most one sentence on what they could say next only if they are in a position to speak; if someone else is presenting or they have been silent, skip that and recap only.`,
            transcriptWindowMs: LIVE_ASK_CATCH_UP_WINDOW_MS,
          },
          {
            label: t`Sound smart`,
            icon: Lightning,
            prompt: t`Help me sound smart in this meeting. Using only the in-progress transcript from the last 10 minutes, give 2-3 concise talking points in my voice that I can say next. Do not claim I already said them.`,
            transcriptWindowMs: LIVE_ASK_TRANSCRIPT_WINDOW_MS,
          },
          {
            label: t`Draft email`,
            icon: Envelope,
            prompt: t`Draft a follow-up email from this meeting so far, based on the in-progress transcript. I am the sender: write in first person as me to the other people on the call, never refer to me in the third person, and do not write the other company's internal recap. Write it in my voice — how I actually talk — and skip generic AI phrasing. Keep the whole email under 250 words unless I ask for a longer recap. Start with a Subject line, then a blank line, then the body. Use short paragraphs and bullet points when they help scanning. Light markdown is OK: bullets, numbered lists, and bold. Do not use headings, tables, or code fences.`,
          },
        ];
  const handleRecipeClick = useCallback(
    (label: string, prompt: string, transcriptWindowMs?: number) => {
      onSendMessage?.(
        label,
        [{ type: "text", text: label }],
        undefined,
        prompt,
        transcriptWindowMs,
      );
    },
    [onSendMessage],
  );

  const disableRecipes = variant === "live" && isBatchOnly;

  return (
    <div data-live-ask-rail className="shrink-0 px-1 pb-1.5">
      {variant === "live" && isBatchOnly ? (
        <p
          role="status"
          data-live-ask-batch-warning
          className="text-muted-foreground mb-1.5 px-2 text-center text-xs leading-relaxed"
        >
          {t`Live Ask needs a live transcription model. Choose Deepgram Nova 3 (Acorn’s default) in Settings → Intelligence.`}
        </p>
      ) : null}
      {showRecipes ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {recipes.map(({ label, icon: Icon, prompt, transcriptWindowMs }) => (
            <button
              key={label}
              type="button"
              disabled={disableRecipes}
              onClick={() =>
                handleRecipeClick(label, prompt, transcriptWindowMs)
              }
              className={cn([
                "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
                disableRecipes
                  ? "text-muted-foreground/70 cursor-not-allowed"
                  : "text-muted-foreground hover:bg-muted/55 hover:text-foreground",
              ])}
            >
              <Icon size={12} className="shrink-0" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
