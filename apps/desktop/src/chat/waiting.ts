import type { ChatStatus } from "ai";

import { hasRenderableContent } from "~/chat/message-content";
import type { AnlgUIMessage } from "~/chat/types";

export function isWaitingForAssistantContent(
  message: AnlgUIMessage | undefined,
) {
  if (message?.role !== "assistant") {
    return false;
  }

  const lastPart = message.parts[message.parts.length - 1];
  if (!lastPart) {
    return false;
  }

  if (lastPart.type === "step-start") {
    return true;
  }

  const state = "state" in lastPart ? lastPart.state : undefined;
  return (
    lastPart.type.startsWith("tool-") &&
    (state === "output-available" || state === "output-error")
  );
}

export function shouldShowChatThinking(
  status: ChatStatus,
  messages: readonly AnlgUIMessage[],
  awaitingReply = false,
) {
  if (status === "error") {
    return false;
  }

  const last = messages[messages.length - 1];
  const requestInFlight =
    awaitingReply || status === "submitted" || status === "streaming";

  if (!last) {
    return requestInFlight;
  }

  if (last.role === "user") {
    return requestInFlight;
  }

  if (last.role !== "assistant") {
    return requestInFlight;
  }

  if (!hasRenderableContent(last) || isWaitingForAssistantContent(last)) {
    return requestInFlight;
  }

  return false;
}
