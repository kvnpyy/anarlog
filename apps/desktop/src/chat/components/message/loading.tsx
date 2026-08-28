import { Trans } from "@lingui/react/macro";
import { CircleNotch } from "@phosphor-icons/react";

import { MessageBubble, MessageContainer } from "./shared";

export function LoadingMessage() {
  return (
    <MessageContainer align="start">
      <MessageBubble variant="loading">
        <div
          role="status"
          aria-live="polite"
          data-chat-thinking
          className="flex items-center gap-2"
        >
          <CircleNotch className="h-3.5 w-3.5 animate-spin" />
          <span className="text-sm">
            <Trans>Thinking...</Trans>
          </span>
          <span aria-hidden="true" className="flex items-center gap-0.5">
            <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-1 animate-bounce rounded-full bg-current" />
          </span>
        </div>
      </MessageBubble>
    </MessageContainer>
  );
}
