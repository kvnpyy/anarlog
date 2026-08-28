import { describe, expect, it } from "vitest";

import { shouldShowChatThinking } from "./waiting";

import type { AnlgUIMessage } from "~/chat/types";

describe("shouldShowChatThinking", () => {
  it("shows thinking as soon as a send is awaiting a reply", () => {
    expect(shouldShowChatThinking("ready", [], true)).toBe(true);
    expect(
      shouldShowChatThinking(
        "ready",
        [{ id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }] }],
        true,
      ),
    ).toBe(true);
  });

  it("hides thinking while assistant text is already visible", () => {
    expect(
      shouldShowChatThinking(
        "streaming",
        [
          {
            id: "a1",
            role: "assistant",
            parts: [{ type: "text", text: "Hello", state: "streaming" }],
          } as AnlgUIMessage,
        ],
        true,
      ),
    ).toBe(false);
  });

  it("keeps thinking after a tool finishes and before the next text", () => {
    expect(
      shouldShowChatThinking(
        "streaming",
        [
          {
            id: "a1",
            role: "assistant",
            parts: [
              {
                type: "tool-search_meetings",
                toolCallId: "search-1",
                state: "output-available",
                input: { query: "q" },
                output: { results: [] },
              },
            ],
          } as AnlgUIMessage,
        ],
        true,
      ),
    ).toBe(true);
  });

  it("does not show thinking for a ready idle thread", () => {
    expect(shouldShowChatThinking("ready", [], false)).toBe(false);
    expect(
      shouldShowChatThinking(
        "ready",
        [{ id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }] }],
        false,
      ),
    ).toBe(false);
  });
});
