import type { EditorView } from "~/store/zustand/tabs/schema";

export function getSelectedEnhancedNoteId(
  currentView: EditorView | null,
  enhancedNoteIds: readonly string[],
): string | null {
  if (
    currentView?.type === "enhanced" &&
    enhancedNoteIds.includes(currentView.id)
  ) {
    return currentView.id;
  }

  return enhancedNoteIds[0] ?? null;
}

export function getMeetingNotePane({
  currentView,
  isRecording,
  enhancedHasContent,
  isEnhancing,
}: {
  currentView: EditorView;
  isRecording: boolean;
  enhancedHasContent: boolean;
  isEnhancing: boolean;
}): "raw" | "enhanced" | "transcript" {
  if (isRecording) {
    if (currentView.type === "transcript") {
      return "transcript";
    }

    return "raw";
  }

  if (currentView.type === "transcript") {
    return "transcript";
  }

  if (currentView.type === "enhanced" && (enhancedHasContent || isEnhancing)) {
    return "enhanced";
  }

  return "raw";
}

export function computeCurrentNoteTab(
  tabView: EditorView | null,
  isLiveSessionActive: boolean,
  enhancedNoteIds: readonly string[],
  canShowTranscript = false,
): EditorView {
  const firstEnhancedNoteId = enhancedNoteIds[0];
  const hasEnhancedNote = (id: string) => enhancedNoteIds.includes(id);

  if (isLiveSessionActive) {
    if (tabView?.type === "transcript" && canShowTranscript) {
      return tabView;
    }

    return { type: "raw" };
  }

  if (tabView) {
    if (tabView.type === "raw") {
      return tabView;
    }
    if (tabView.type === "enhanced") {
      return hasEnhancedNote(tabView.id)
        ? tabView
        : firstEnhancedNoteId
          ? { type: "enhanced", id: firstEnhancedNoteId }
          : { type: "raw" };
    }
    if (tabView.type === "transcript" && canShowTranscript) {
      return tabView;
    }

    return { type: "raw" };
  }

  if (firstEnhancedNoteId) {
    return { type: "enhanced", id: firstEnhancedNoteId };
  }

  return { type: "raw" };
}
