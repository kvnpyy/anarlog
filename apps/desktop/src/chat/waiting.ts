import type { ChatStatus } from "ai";

import type { AnlgUIMessage } from "~/chat/types";

export function assistantTurnHasAnswerText(message: AnlgUIMessage | undefined) {
  if (message?.role !== "assistant" || !Array.isArray(message.parts)) {
    return false;
  }

  let start = 0;
  message.parts.forEach((part, index) => {
    if (part.type === "step-start") {
      start = index + 1;
    }
  });

  return message.parts.slice(start).some((part) => {
    return (
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string" &&
      part.text.trim().length > 0
    );
  });
}

export function shouldShowChatThinking(
  status: ChatStatus,
  messages: readonly AnlgUIMessage[],
  awaitingReply = false,
) {
  if (status === "error") {
    return false;
  }

  const requestInFlight =
    awaitingReply || status === "submitted" || status === "streaming";
  if (!requestInFlight) {
    return false;
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") {
    return true;
  }

  return !assistantTurnHasAnswerText(last);
}
