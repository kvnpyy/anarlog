import { useEffect, useState } from "react";

import { sonnerToast } from "@anlg/ui/components/ui/toast";

import { getEnhancerService } from "~/services/enhancer";
import {
  getAutoEnhancePendingNoteId,
  isAutoEnhancePending,
  subscribeAutoEnhancePending,
} from "~/services/enhancer/pending-ui";
import { type Tab, useTabs } from "~/store/zustand/tabs";

export function useAutoEnhance(tab: Extract<Tab, { type: "sessions" }>) {
  const sessionId = tab.id;
  const [skipReason, setSkipReason] = useState<string | null>(null);

  useEffect(() => {
    const switchToEnhanced = (noteId: string) => {
      const tabsState = useTabs.getState();
      const sessionTab = tabsState.tabs.find(
        (t): t is Extract<Tab, { type: "sessions" }> =>
          t.type === "sessions" && t.id === sessionId,
      );
      if (sessionTab) {
        tabsState.updateSessionTabState(sessionTab, {
          ...sessionTab.state,
          view: { type: "enhanced", id: noteId },
        });
      }
    };

    const pendingNoteId = getAutoEnhancePendingNoteId(sessionId);
    if (pendingNoteId) {
      switchToEnhanced(pendingNoteId);
    }

    const unsubPending = subscribeAutoEnhancePending(() => {
      if (!isAutoEnhancePending(sessionId)) {
        return;
      }
      const noteId = getAutoEnhancePendingNoteId(sessionId);
      if (noteId) {
        switchToEnhanced(noteId);
      }
    });

    const service = getEnhancerService();
    if (!service) {
      return unsubPending;
    }
    const unsubService = service.on((event) => {
      if (event.sessionId !== sessionId) return;
      if (event.type === "auto-enhance-skipped") {
        setSkipReason(event.reason);
        if (event.reasonCode === "transcript_too_short") {
          sonnerToast.warning("Summary wasn't generated", {
            id: `auto-summary-too-short-${sessionId}`,
            description: event.reason,
          });
        }
      }
      if (event.type === "auto-enhance-started") {
        switchToEnhanced(event.noteId);
      }
      if (event.type === "auto-enhance-no-model") {
        setSkipReason("No AI model configured");
      }
    });
    return () => {
      unsubPending();
      unsubService();
    };
  }, [sessionId]);

  useEffect(() => {
    if (skipReason) {
      const timer = setTimeout(() => setSkipReason(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [skipReason]);

  return { skipReason };
}
