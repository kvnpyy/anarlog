import { Trans, useLingui } from "@lingui/react/macro";
import { Check } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { cn } from "@anlg/utils";

import { useTranscriptSelectionState } from "./selection-context";
import {
  getAssignmentAnchorWordId,
  getAssignmentWordIds,
  SpeakerAssignPopover,
} from "./speaker-assign";
import { useSegmentColorVars } from "./utils";

import { trackAnalyticsEvent } from "~/analytics";
import type { Segment } from "~/stt/live-segment";
import { assignTranscriptSpeaker } from "~/stt/queries";

export function SegmentHeader({
  segment,
  transcriptId,
  sessionId,
  label,
  suggestedHumanId,
  selected = false,
}: {
  segment: Segment;
  transcriptId: string;
  sessionId?: string;
  label: string;
  suggestedHumanId?: string;
  selected?: boolean;
}) {
  const { t } = useLingui();
  const { selectMode } = useTranscriptSelectionState();
  const colorVars = useSegmentColorVars(segment.key);
  const [confirming, setConfirming] = useState(false);
  const headerClassName = cn([
    "relative py-1",
    "text-xs font-light",
    "flex items-center gap-2",
    "[--segment-color:var(--segment-color-light)]",
    "dark:[--segment-color:var(--segment-color-dark)]",
  ]);

  const handleConfirmSuggestion = useCallback(() => {
    if (!suggestedHumanId || segment.words.length === 0) {
      return;
    }
    const anchorWordId = getAssignmentAnchorWordId(segment);
    if (!anchorWordId) {
      return;
    }

    setConfirming(true);
    void assignTranscriptSpeaker({
      transcriptId,
      segmentKey: segment.key,
      humanId: suggestedHumanId,
      anchorWordId,
      mode: "all",
      wordIds: getAssignmentWordIds(segment),
    })
      .then(() => {
        trackAnalyticsEvent("participant_assigned", {
          assignment_scope: "all",
          word_count: segment.words.length,
          source: "voiceprint_suggestion",
        });
      })
      .catch((error) => {
        console.error("[transcript] failed to confirm speaker", error);
      })
      .finally(() => setConfirming(false));
  }, [segment, suggestedHumanId, transcriptId]);

  return (
    <div className={headerClassName} style={colorVars}>
      {selectMode ? (
        <span
          aria-hidden="true"
          className={cn([
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40",
          ])}
        >
          {selected ? <Check className="size-2.5" weight="bold" /> : null}
        </span>
      ) : null}
      <SpeakerAssignPopover
        segment={segment}
        transcriptId={transcriptId}
        sessionId={sessionId}
        color="var(--segment-color)"
        label={label}
      />
      {suggestedHumanId && !selectMode ? (
        <button
          type="button"
          className={cn([
            "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            "inline-flex h-5 items-center rounded-full border px-1.5 text-[11px]",
            "disabled:pointer-events-none disabled:opacity-50",
          ])}
          disabled={confirming}
          aria-label={t`Confirm speaker`}
          onClick={handleConfirmSuggestion}
        >
          <Check className="size-3" weight="bold" />
          <span className="ml-1">
            <Trans>Confirm</Trans>
          </span>
        </button>
      ) : null}
    </div>
  );
}
