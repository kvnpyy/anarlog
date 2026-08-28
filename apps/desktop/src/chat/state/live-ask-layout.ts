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
