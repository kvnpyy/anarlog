import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agentStream: vi.fn(),
  getRecentLiveTranscriptContext: vi.fn(() => null as string | null),
  smoothStream: vi.fn(),
  streamTransform: vi.fn(),
}));

vi.mock("~/chat/context/live-transcript-snippet", () => ({
  getRecentLiveTranscriptContext: mocks.getRecentLiveTranscriptContext,
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  smoothStream: mocks.smoothStream,
  ToolLoopAgent: class {
    stream = mocks.agentStream;
  },
}));

import { CustomChatTransport } from "./index";

describe("CustomChatTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecentLiveTranscriptContext.mockReturnValue(null);
    mocks.smoothStream.mockReturnValue(mocks.streamTransform);
    mocks.agentStream.mockResolvedValue({
      toUIMessageStream: vi.fn(
        () =>
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
      ),
    });
  });

  it("paces streamed chat responses line by line like summary generation", async () => {
    const transport = new CustomChatTransport({} as never, {});

    await transport.sendMessages({
      abortSignal: new AbortController().signal,
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Summarize this meeting" }],
        },
      ],
      trigger: "submit-message",
    });

    expect(mocks.smoothStream).toHaveBeenCalledWith({
      chunking: "line",
      delayInMs: 250,
    });
    expect(mocks.agentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_transform: mocks.streamTransform,
      }),
    );
  });

  it("prepends in-progress transcript context to the last user message", async () => {
    mocks.getRecentLiveTranscriptContext.mockReturnValue(
      "IN-PROGRESS TRANSCRIPT (last 10 minutes):\nYou: Let's ship Friday",
    );

    const transport = new CustomChatTransport({} as never, {});

    await transport.sendMessages({
      abortSignal: new AbortController().signal,
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Catch me up" }],
          metadata: {
            contextRefs: [
              {
                kind: "session",
                key: "session:auto:session-1",
                source: "auto-current",
                sessionId: "session-1",
              },
            ],
          },
        },
      ],
      trigger: "submit-message",
    });

    expect(mocks.getRecentLiveTranscriptContext).toHaveBeenCalledWith(
      "session-1",
    );
    const streamArgs = mocks.agentStream.mock.calls[0]?.[0] as {
      messages: unknown;
    };
    const serialized = JSON.stringify(streamArgs.messages);
    expect(serialized).toContain("IN-PROGRESS TRANSCRIPT (last 10 minutes):");
    expect(serialized).toContain("Let's ship Friday");
    expect(serialized).toContain("Catch me up");
  });

  it("sends the hidden model prompt while keeping the short label off the model", async () => {
    const transport = new CustomChatTransport({} as never, {});

    await transport.sendMessages({
      abortSignal: new AbortController().signal,
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Sound smart" }],
          metadata: {
            modelPrompt:
              "Help me sound smart in this meeting. Using only the in-progress transcript.",
          },
        },
      ],
      trigger: "submit-message",
    });

    const streamArgs = mocks.agentStream.mock.calls[0]?.[0] as {
      messages: unknown;
    };
    const serialized = JSON.stringify(streamArgs.messages);
    expect(serialized).toContain("Help me sound smart in this meeting");
    expect(serialized).not.toContain("Sound smart");
  });
});
