import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agentStream: vi.fn(),
  constructedModels: [] as unknown[],
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
    constructor(options: { model: unknown }) {
      mocks.constructedModels.push(options.model);
    }
    stream = mocks.agentStream;
  },
}));

import { CustomChatTransport } from "./index";

describe("CustomChatTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constructedModels.length = 0;
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
      "IN-PROGRESS TRANSCRIPT:\nYou: Let's ship Friday",
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
      undefined,
    );
    const streamArgs = mocks.agentStream.mock.calls[0]?.[0] as {
      messages: unknown;
    };
    const serialized = JSON.stringify(streamArgs.messages);
    expect(serialized).toContain("IN-PROGRESS TRANSCRIPT:");
    expect(serialized).toContain("Let's ship Friday");
    expect(serialized).toContain("Catch me up");
  });

  it("windows the live transcript from the last user message", async () => {
    mocks.getRecentLiveTranscriptContext.mockReturnValue(
      "IN-PROGRESS TRANSCRIPT:\nSpeaker 1: Pricing next",
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
            modelPrompt:
              "Catch me up on this meeting. Using only the last 5 minutes of the in-progress transcript.",
            transcriptWindowMs: 5 * 60 * 1000,
          },
        },
      ],
      trigger: "submit-message",
    });

    expect(mocks.getRecentLiveTranscriptContext).toHaveBeenCalledWith(
      "session-1",
      5 * 60 * 1000,
    );
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

  it("uses the smarter model for a deal-analysis question", async () => {
    const everyday = { id: "haiku" };
    const deal = { id: "sonnet" };
    const transport = new CustomChatTransport(
      everyday as never,
      {},
      undefined,
      undefined,
      { dealAnalysisModel: deal as never },
    );

    await transport.sendMessages({
      abortSignal: new AbortController().signal,
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "full meddpicc for Bonobos" }],
        },
      ],
      trigger: "submit-message",
    });

    expect(mocks.constructedModels).toEqual([deal]);
  });

  it("answers with the daily limit instead of calling the model", async () => {
    const transport = new CustomChatTransport(
      {} as never,
      {},
      undefined,
      undefined,
      {
        reserveTurn: async () => ({
          allowed: false,
          message: "You've used today's 30 free AI questions.",
        }),
      },
    );

    const stream = await transport.sendMessages({
      abortSignal: new AbortController().signal,
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "What did we decide?" }],
        },
      ],
      trigger: "submit-message",
    });

    const chunks: Array<{ type: string; delta?: string }> = [];
    const reader = stream.getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value as { type: string; delta?: string });
    }

    expect(mocks.agentStream).not.toHaveBeenCalled();
    expect(chunks.map((chunk) => chunk.delta).join("")).toContain(
      "30 free AI questions",
    );
  });
});
