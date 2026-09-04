import { t } from "@lingui/core/macro";
import {
  ClockCounterClockwise,
  Envelope,
  Lightning,
} from "@phosphor-icons/react";
import { useCallback } from "react";

import { cn } from "@anlg/utils";

import type { ContextRef } from "~/chat/context/entities";

export function LiveAskRail({
  isBatchOnly,
  onSendMessage,
  showRecipes = true,
}: {
  isBatchOnly: boolean;
  onSendMessage?: (
    content: string,
    parts: Array<{ type: "text"; text: string }>,
    contextRefs?: ContextRef[],
    modelPrompt?: string,
  ) => void;
  showRecipes?: boolean;
}) {
  const recipes = [
    {
      label: t`Catch me up`,
      icon: ClockCounterClockwise,
      prompt: t`Catch me up on this meeting. Using only the last 5 minutes of the in-progress transcript, give 3-5 short bullets of what just happened, then one sentence on what I should say next.`,
    },
    {
      label: t`Sound smart`,
      icon: Lightning,
      prompt: t`Help me sound smart in this meeting. Using only the in-progress transcript from the last 10 minutes, give 2-3 concise talking points in my voice that I can say next.`,
    },
    {
      label: t`Draft email`,
      icon: Envelope,
      prompt: t`Draft a follow-up email from this meeting so far, based on the in-progress transcript. Write it in my voice — how I actually talk — and skip generic AI phrasing. Keep the whole email under 150 words. Start with a Subject line, then a blank line, then the body. Use short paragraphs and bullet points when they help scanning. Light markdown is OK: bullets, numbered lists, and bold. Do not use headings, tables, or code fences.`,
    },
  ];
  const handleRecipeClick = useCallback(
    (label: string, prompt: string) => {
      onSendMessage?.(
        label,
        [{ type: "text", text: label }],
        undefined,
        prompt,
      );
    },
    [onSendMessage],
  );

  return (
    <div data-live-ask-rail className="shrink-0 px-3 pb-1.5">
      {isBatchOnly ? (
        <p
          role="status"
          data-live-ask-batch-warning
          className="text-muted-foreground mb-1.5 text-xs leading-relaxed"
        >
          {t`Live Ask needs a live transcription model. Choose Deepgram Nova 3 (Acorn’s default) in Settings → Intelligence.`}
        </p>
      ) : null}
      {showRecipes ? (
        <div className="flex flex-wrap gap-1.5">
          {recipes.map(({ label, icon: Icon, prompt }) => (
            <button
              key={label}
              type="button"
              disabled={isBatchOnly}
              onClick={() => handleRecipeClick(label, prompt)}
              className={cn([
                "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                isBatchOnly
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
