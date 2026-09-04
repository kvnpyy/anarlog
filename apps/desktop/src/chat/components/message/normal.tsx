import { useLingui } from "@lingui/react/macro";
import {
  ArrowCounterClockwise,
  Brain,
  Check,
  Copy,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@anlg/utils";

import { Disclosure, MessageBubble, MessageContainer } from "./shared";
import { Tool } from "./tool";
import type { Part } from "./types";

import { hasRenderableContent } from "~/chat/components/shared";
import { toCopyableChatText } from "~/chat/copy-text";
import {
  GMAIL_LINE_HEIGHT,
  GMAIL_TEXT_FONT,
  GMAIL_TEXT_SIZE,
  isEmailDraft,
  splitEmailDraft,
  toGmailCopyHtml,
  toGmailCopyPlainText,
} from "~/chat/gmail-draft";
import type { AnlgUIMessage } from "~/chat/types";

function getMessageText(message: AnlgUIMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<Part, { type: "text" }> => part.type === "text",
    )
    .map((part) => part.text)
    .join("\n");
}

export function NormalMessage({
  message,
  handleReload,
}: {
  message: AnlgUIMessage;
  handleReload?: () => void;
}) {
  const { t } = useLingui();
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const copiedResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const text = toCopyableChatText(getMessageText(message));
    try {
      if (isEmailDraft(text)) {
        await copyGmailDraft(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }
      setCopied(true);
      copiedResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copiedResetTimeoutRef.current = null;
      }, 2000);
    } catch {
      // ignore
    }
  }, [message]);

  if (!hasRenderableContent(message)) {
    return null;
  }

  return (
    <MessageContainer align={isUser ? "end" : "start"}>
      <div
        className={cn([
          "flex min-w-0 flex-col overflow-hidden",
          isUser ? "max-w-[85%] items-end" : "group w-full max-w-full",
        ])}
      >
        <MessageBubble variant={isUser ? "user" : "assistant"}>
          {message.parts.map((part, i) => (
            <Part key={i} part={part as Part} />
          ))}
        </MessageBubble>
        {!isUser && (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className={`p-1 transition-colors ${copied ? "text-green-500" : "text-muted-foreground hover:text-foreground"}`}
              aria-label={t`Copy message`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {handleReload && (
              <button
                onClick={handleReload}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                aria-label={t`Regenerate message`}
              >
                <ArrowCounterClockwise size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </MessageContainer>
  );
}

function Part({ part }: { part: Part }) {
  if (part.type === "reasoning") {
    return <Reasoning part={part} />;
  }
  if (part.type === "text") {
    return <Text part={part} />;
  }
  if (part.type === "step-start") {
    return null;
  }

  return <Tool part={part} />;
}

function Reasoning({ part }: { part: Extract<Part, { type: "reasoning" }> }) {
  const raw = part.text.trim();

  if (!raw) {
    return null;
  }

  const cleaned = raw
    .replace(/[\n`*#"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const streaming = part.state !== "done";
  const title = streaming ? cleaned.slice(-150) : cleaned;

  if (!title) {
    return null;
  }

  return (
    <Disclosure
      icon={<Brain className="h-3 w-3" />}
      title={title}
      disabled={streaming}
    >
      <div className="text-muted-foreground text-sm whitespace-pre-wrap">
        {part.text}
      </div>
    </Disclosure>
  );
}

const chatComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
    return (
      <h1 className="mt-2 mb-1 text-sm font-semibold first:mt-0">
        {props.children as React.ReactNode}
      </h1>
    );
  },
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
    return (
      <h2 className="mt-2 mb-1 text-sm font-semibold first:mt-0">
        {props.children as React.ReactNode}
      </h2>
    );
  },
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
    return (
      <h3 className="mt-1.5 mb-1 text-[13px] font-semibold first:mt-0">
        {props.children as React.ReactNode}
      </h3>
    );
  },
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => {
    return (
      <ul className="mb-1 list-disc pl-4">
        {props.children as React.ReactNode}
      </ul>
    );
  },
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => {
    return (
      <ol className="mb-1 list-decimal pl-4">
        {props.children as React.ReactNode}
      </ol>
    );
  },
  li: (props: React.HTMLAttributes<HTMLLIElement>) => {
    return <li className="mb-0.5">{props.children as React.ReactNode}</li>;
  },
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => {
    return (
      <p className="mb-1 last:mb-0">{props.children as React.ReactNode}</p>
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => {
    return (
      <pre className="bg-muted/60 my-1.5 max-w-full overflow-x-auto rounded-md p-2 text-xs">
        {props.children as React.ReactNode}
      </pre>
    );
  },
  table: (props: React.HTMLAttributes<HTMLTableElement>) => {
    return (
      <div className="my-1.5 max-w-full overflow-x-auto">
        <table className="w-max min-w-full text-xs">{props.children}</table>
      </div>
    );
  },
} as const;

function Text({ part }: { part: Extract<Part, { type: "text" }> }) {
  const isAnimating = part.state !== "done";

  if (isEmailDraft(part.text)) {
    return <EmailDraftBody isAnimating={isAnimating} text={part.text} />;
  }

  return (
    <Streamdown
      components={chatComponents}
      className="max-w-full overflow-hidden px-0.5 py-0.5 [overflow-wrap:anywhere] break-words"
      caret="block"
      isAnimating={isAnimating}
      linkSafety={{ enabled: false }}
    >
      {part.text}
    </Streamdown>
  );
}

function EmailDraftBody({
  isAnimating,
  text,
}: {
  isAnimating: boolean;
  text: string;
}) {
  const { subject, body } = splitEmailDraft(text);

  return (
    <div data-email-draft className="max-w-full overflow-hidden">
      {subject ? (
        <div className="text-muted-foreground mb-2 text-xs">
          Subject:{" "}
          <span className="text-foreground font-medium">{subject}</span>
        </div>
      ) : null}
      <div
        data-gmail-body
        className="max-w-full overflow-hidden px-0.5 py-0.5 [overflow-wrap:anywhere] break-words text-[#222222] dark:text-neutral-200"
        style={{
          fontFamily: GMAIL_TEXT_FONT,
          fontSize: GMAIL_TEXT_SIZE,
          lineHeight: GMAIL_LINE_HEIGHT,
        }}
      >
        <Streamdown
          components={gmailComponents}
          className="max-w-full overflow-hidden [overflow-wrap:anywhere] break-words"
          caret="block"
          isAnimating={isAnimating}
          linkSafety={{ enabled: false }}
        >
          {body}
        </Streamdown>
      </div>
    </div>
  );
}

const gmailComponents = {
  ...chatComponents,
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => {
    return (
      <p
        className="mb-3 last:mb-0"
        style={{
          fontFamily: GMAIL_TEXT_FONT,
          fontSize: GMAIL_TEXT_SIZE,
          lineHeight: GMAIL_LINE_HEIGHT,
        }}
      >
        {props.children as React.ReactNode}
      </p>
    );
  },
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => {
    return (
      <ul
        className="mb-3 list-disc pl-6 last:mb-0"
        style={{
          fontFamily: GMAIL_TEXT_FONT,
          fontSize: GMAIL_TEXT_SIZE,
          lineHeight: GMAIL_LINE_HEIGHT,
        }}
      >
        {props.children as React.ReactNode}
      </ul>
    );
  },
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => {
    return (
      <ol
        className="mb-3 list-decimal pl-6 last:mb-0"
        style={{
          fontFamily: GMAIL_TEXT_FONT,
          fontSize: GMAIL_TEXT_SIZE,
          lineHeight: GMAIL_LINE_HEIGHT,
        }}
      >
        {props.children as React.ReactNode}
      </ol>
    );
  },
  li: (props: React.HTMLAttributes<HTMLLIElement>) => {
    return (
      <li
        className="mb-1"
        style={{
          fontFamily: GMAIL_TEXT_FONT,
          fontSize: GMAIL_TEXT_SIZE,
          lineHeight: GMAIL_LINE_HEIGHT,
        }}
      >
        {props.children as React.ReactNode}
      </li>
    );
  },
} as const;

async function copyGmailDraft(text: string) {
  const plain = toGmailCopyPlainText(text);
  const html = toGmailCopyHtml(text);

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(plain);
  }
}
