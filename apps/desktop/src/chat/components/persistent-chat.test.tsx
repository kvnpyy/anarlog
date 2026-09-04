import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatMode: {
    current: "FloatingOpen" as
      | "FloatingClosed"
      | "FloatingOpen"
      | "RightPanelOpen",
  },
  sendEvent: vi.fn(),
  tabType: undefined as string | undefined,
  sessionProps: {
    contextEntities: [],
    isSystemPromptReady: true,
    messages: [] as ChatSessionRenderProps["messages"],
    onAddContextEntity: vi.fn(),
    onDraftContextRefsChange: vi.fn(),
    onRemoveContextEntity: vi.fn(),
    pendingRefs: [],
    regenerate: vi.fn(),
    sendMessage: vi.fn(),
    sessionId: "chat-session-1",
    setMessages: vi.fn(),
    status: "ready" as const,
    stop: vi.fn(),
  },
}));

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: vi.fn(),
}));

vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: {
      mode: mocks.chatMode.current,
      sendEvent: mocks.sendEvent,
    },
  }),
}));

vi.mock("./chat-panel", () => ({
  ChatPanelFrame: ({
    layout,
    pageIntegrated,
    onDraftContentChange,
    onOpenRightPanel,
    sessionProps,
  }: {
    layout?: "floating" | "right-panel";
    pageIntegrated?: boolean;
    onDraftContentChange?: (hasDraftContent: boolean) => void;
    onOpenRightPanel?: () => void;
    sessionProps: unknown;
  }) => (
    <>
      <button
        data-has-session={String(sessionProps === mocks.sessionProps)}
        data-layout={layout}
        data-page-integrated={String(pageIntegrated)}
        data-testid="open-right-panel"
        type="button"
        onClick={onOpenRightPanel}
      >
        Open right panel
      </button>
      <button
        data-testid="mark-draft-content"
        type="button"
        onClick={() => onDraftContentChange?.(true)}
      >
        Mark draft content
      </button>
      <div data-testid="chat-view" />
    </>
  ),
}));

import { PersistentChatPanel } from "./persistent-chat";

import type { ChatSessionRenderProps } from "~/chat/components/session-provider";

function TestHost() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} data-testid="full-panel-container">
      <div data-chat-floating-anchor>
        <div data-chat-page-content data-testid="note-surface" />
        <div data-chat-page-slot />
      </div>
      <PersistentChatPanel
        floatingContainerRef={containerRef}
        sessionProps={mocks.sessionProps}
        tabType={mocks.tabType}
      />
    </div>
  );
}

describe("PersistentChatPanel", () => {
  beforeEach(() => {
    cleanup();
    mocks.chatMode.current = "FloatingOpen";
    mocks.sessionProps.messages = [];
    mocks.sessionProps.status = "ready";
    mocks.tabType = undefined;
    mocks.sendEvent.mockClear();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  });

  it("keeps a static page-integrated composer on the notepad until chat starts", async () => {
    mocks.chatMode.current = "FloatingClosed";

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const pageComposer = document.querySelector("[data-chat-page-composer]");
    const panel = document.querySelector<HTMLElement>("[data-chat-panel]");
    const pageSlot = document.querySelector("[data-chat-page-slot]");

    expect(screen.getByTestId("open-right-panel").dataset.pageIntegrated).toBe(
      "true",
    );
    expect(pageComposer?.getAttribute("data-chat-page-integrated")).toBe(
      "true",
    );
    expect(document.querySelector("[data-chat-floating-frame]")).toBeNull();
    expect(pageComposer?.parentElement).toBe(pageSlot);
    expect(panel?.className).toContain("bg-transparent");
    expect(panel?.className).not.toContain("rounded-[24px]");
    expect(panel?.dataset.chatPanelReveal).toBe("page");
  });

  it("docks the composer in the notepad footer instead of overlaying notes", async () => {
    render(<TestHost />);

    await screen.findByTestId("chat-view");

    expect(screen.getByTestId("open-right-panel").dataset.hasSession).toBe(
      "true",
    );
    const pageComposer = document.querySelector<HTMLElement>(
      "[data-chat-page-composer]",
    );
    const panel = document.querySelector<HTMLElement>("[data-chat-panel]");
    const pageSlot = document.querySelector("[data-chat-page-slot]");

    await waitFor(() => {
      expect(pageComposer?.parentElement).toBe(pageSlot);
      expect(pageComposer?.parentElement).not.toBe(document.body);
      expect(getComputedStyle(pageComposer!).position).not.toBe("fixed");
      expect(pageComposer?.className).toContain("mx-auto");
      expect(pageComposer?.className).toContain("px-3");
      expect(pageComposer?.className).toContain("pb-2");
      expect(panel?.style.maxHeight).toBe("22rem");
      expect(panel?.dataset.chatPanelReveal).toBe("page");
    });
  });

  it("lifts into a chat panel once a conversation is happening", async () => {
    mocks.sessionProps.messages = [
      { id: "m1" },
    ] as unknown as ChatSessionRenderProps["messages"];

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const floatingFrame = document.querySelector("[data-chat-floating-frame]");
    const floatingOverlay = floatingFrame?.parentElement;
    const panel = document.querySelector<HTMLElement>("[data-chat-panel]");

    expect(screen.getByTestId("open-right-panel").dataset.pageIntegrated).toBe(
      "false",
    );
    expect(document.querySelector("[data-chat-page-composer]")).toBeNull();
    expect(floatingOverlay?.parentElement).toBe(document.body);
    expect(floatingFrame?.className).toContain("pointer-events-auto");
    expect(panel?.className).toContain("rounded-[24px]");
    expect(panel?.dataset.chatPanelReveal).toBe("lift");
  });

  it("collapses an expanded note conversation when the notes are clicked", async () => {
    mocks.tabType = "sessions";
    mocks.sessionProps.messages = [
      { id: "m1" },
    ] as unknown as ChatSessionRenderProps["messages"];

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const pageComposer = document.querySelector("[data-chat-page-composer]");
    expect(pageComposer?.getAttribute("data-chat-page-thread")).toBe(
      "expanded",
    );

    fireEvent.pointerDown(screen.getByTestId("note-surface"));

    expect(mocks.sendEvent).toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("expands a collapsed note conversation when the composer is clicked", async () => {
    mocks.chatMode.current = "FloatingClosed";
    mocks.tabType = "sessions";
    mocks.sessionProps.messages = [
      { id: "m1" },
    ] as unknown as ChatSessionRenderProps["messages"];

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const pageComposer = document.querySelector<HTMLElement>(
      "[data-chat-page-composer]",
    );
    expect(pageComposer?.getAttribute("data-chat-page-thread")).toBe(
      "collapsed",
    );

    fireEvent.pointerDown(pageComposer!);

    expect(mocks.sendEvent).toHaveBeenCalledWith({ type: "OPEN" });
  });

  it("keeps a note conversation page-integrated instead of lifting a card", async () => {
    mocks.tabType = "sessions";
    mocks.sessionProps.messages = [
      { id: "m1" },
    ] as unknown as ChatSessionRenderProps["messages"];

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const pageComposer = document.querySelector("[data-chat-page-composer]");
    const panel = document.querySelector<HTMLElement>("[data-chat-panel]");
    const pageSlot = document.querySelector("[data-chat-page-slot]");

    expect(screen.getByTestId("open-right-panel").dataset.pageIntegrated).toBe(
      "true",
    );
    expect(pageComposer?.getAttribute("data-chat-page-integrated")).toBe(
      "true",
    );
    expect(pageComposer?.parentElement).toBe(pageSlot);
    expect(document.querySelector("[data-chat-floating-frame]")).toBeNull();
    expect(panel?.className).toContain("bg-transparent");
    expect(panel?.dataset.chatPanelReveal).toBe("page");
    expect(pageComposer?.getAttribute("data-chat-page-thread")).toBe(
      "expanded",
    );
  });

  it("opens the docked right panel from the toolbar action", async () => {
    render(<TestHost />);

    await screen.findByTestId("chat-view");

    fireEvent.click(screen.getByTestId("open-right-panel"));

    expect(mocks.sendEvent).toHaveBeenCalledWith({
      type: "OPEN_RIGHT_PANEL",
    });
  });

  it("has no overlay backdrop on the notepad composer", async () => {
    render(<TestHost />);

    await screen.findByTestId("chat-view");

    expect(document.querySelector("[data-chat-floating-frame]")).toBeNull();
    expect(document.querySelector("[data-chat-page-composer]")).toBeTruthy();
    expect(mocks.sendEvent).not.toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("closes an active conversation on backdrop click while the draft is empty", async () => {
    mocks.sessionProps.messages = [
      { id: "m1" },
    ] as unknown as ChatSessionRenderProps["messages"];

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const floatingFrame = document.querySelector<HTMLElement>(
      "[data-chat-floating-frame]",
    );

    fireEvent.click(floatingFrame!);

    expect(mocks.sendEvent).toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("keeps the expanded composer open on backdrop click when draft has content", async () => {
    mocks.sessionProps.messages = [
      { id: "m1" },
    ] as unknown as ChatSessionRenderProps["messages"];

    render(<TestHost />);

    await screen.findByTestId("chat-view");

    fireEvent.click(screen.getByTestId("mark-draft-content"));
    mocks.sendEvent.mockClear();

    const floatingFrame = document.querySelector<HTMLElement>(
      "[data-chat-floating-frame]",
    );

    fireEvent.click(floatingFrame!);

    expect(mocks.sendEvent).not.toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("does not expose resize handles on the floating panel", async () => {
    render(<TestHost />);

    await screen.findByTestId("chat-view");

    const panel = document.querySelector<HTMLElement>("[data-chat-panel]");

    expect(panel).toBeTruthy();
    expect(document.querySelector("[data-chat-resize-frame]")).toBeNull();
    expect(document.querySelector("[data-chat-resize-handle]")).toBeNull();
  });

  it("hides the floating panel when the chat moves to the right panel", async () => {
    const { rerender } = render(<TestHost />);

    await screen.findByTestId("chat-view");

    mocks.chatMode.current = "RightPanelOpen";
    rerender(<TestHost />);

    await waitFor(() => {
      expect(
        document.querySelector<HTMLElement>("[data-chat-panel]"),
      ).toBeNull();
    });
  });
});
