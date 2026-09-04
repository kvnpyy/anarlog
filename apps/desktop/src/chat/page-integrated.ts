import type { ChatStatus } from "ai";

import type { ChatMode } from "~/store/zustand/tabs";

export function shouldShowPersistentChatOverlay(
  tab: { type: string } | null | undefined,
): boolean {
  return tab?.type === "sessions" || tab?.type === "empty";
}

export function isPageIntegratedChat({
  mode,
  messageCount,
  status,
  tabType,
}: {
  mode: ChatMode;
  messageCount: number;
  status?: ChatStatus;
  tabType?: string;
}): boolean {
  if (mode === "RightPanelOpen") {
    return false;
  }

  // Notes keep a Granola-style page composer so chat never lifts over the note.
  if (tabType === "sessions") {
    return true;
  }

  const hasConversation =
    messageCount > 0 || status === "streaming" || status === "submitted";

  return mode === "FloatingClosed" || !hasConversation;
}

export function hasPageChatConversation({
  messageCount,
  status,
}: {
  messageCount: number;
  status?: ChatStatus;
}): boolean {
  return messageCount > 0 || status === "streaming" || status === "submitted";
}

export function isPageChatThreadCollapsed({
  pageIntegrated,
  mode,
}: {
  pageIntegrated: boolean;
  mode: ChatMode;
}): boolean {
  return pageIntegrated && mode === "FloatingClosed";
}

export function shouldCollapsePageChatOnNoteClick({
  pageIntegrated,
  mode,
  messageCount,
  status,
}: {
  pageIntegrated: boolean;
  mode: ChatMode;
  messageCount: number;
  status?: ChatStatus;
}): boolean {
  return (
    pageIntegrated &&
    mode === "FloatingOpen" &&
    hasPageChatConversation({ messageCount, status })
  );
}

export function shouldExpandPageChatOnComposerClick({
  pageIntegrated,
  mode,
}: {
  pageIntegrated: boolean;
  mode: ChatMode;
}): boolean {
  return pageIntegrated && mode === "FloatingClosed";
}
