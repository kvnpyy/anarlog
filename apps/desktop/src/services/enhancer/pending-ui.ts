import { useSyncExternalStore } from "react";

const pendingNoteBySession = new Map<string, string | true>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function setAutoEnhancePending(
  sessionId: string,
  noteId: string | true,
) {
  const previous = pendingNoteBySession.get(sessionId);
  if (previous === noteId) {
    return;
  }
  pendingNoteBySession.set(sessionId, noteId);
  emit();
}

export function clearAutoEnhancePending(sessionId: string) {
  if (!pendingNoteBySession.delete(sessionId)) {
    return;
  }
  emit();
}

export function isAutoEnhancePending(sessionId: string): boolean {
  return pendingNoteBySession.has(sessionId);
}

export function getAutoEnhancePendingNoteId(sessionId: string): string | null {
  const noteId = pendingNoteBySession.get(sessionId);
  return typeof noteId === "string" ? noteId : null;
}

export function subscribeAutoEnhancePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAutoEnhancePendingForTests() {
  if (pendingNoteBySession.size === 0) {
    return;
  }
  pendingNoteBySession.clear();
  emit();
}

export function useAutoEnhancePending(sessionId: string): boolean {
  return useSyncExternalStore(
    subscribeAutoEnhancePending,
    () => isAutoEnhancePending(sessionId),
    () => false,
  );
}
