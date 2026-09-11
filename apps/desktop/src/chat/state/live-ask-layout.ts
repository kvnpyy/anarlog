export function shouldInlineLiveAsk({
  isRecording,
  liveSessionId,
  currentTab,
}: {
  isRecording: boolean;
  liveSessionId: string | null | undefined;
  currentTab: { type: string; id?: string } | null | undefined;
}): boolean {
  return (
    isRecording &&
    currentTab?.type === "sessions" &&
    Boolean(liveSessionId) &&
    currentTab.id === liveSessionId
  );
}

export function shouldUseLiveAskContext({
  liveSessionId,
  currentSessionId,
}: {
  liveSessionId: string | null | undefined;
  currentSessionId: string | undefined;
}): boolean {
  if (!liveSessionId) {
    return false;
  }

  return currentSessionId == null || currentSessionId === liveSessionId;
}
