import { cleanup, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appearanceState = vi.hoisted(() => ({
  isDarkAppearance: true,
}));

vi.mock("~/chat/hooks/use-chat-appearance", () => ({
  useChatAppearance: () => ({
    isDarkAppearance: appearanceState.isDarkAppearance,
    toolbarSurface: appearanceState.isDarkAppearance ? "dark" : "light",
    panelClassName: appearanceState.isDarkAppearance
      ? "bg-primary text-primary-foreground"
      : "bg-card text-foreground",
    panelBorderClassName: appearanceState.isDarkAppearance
      ? "border-primary/80"
      : "border-border",
    elevatedSurfaceClassName: appearanceState.isDarkAppearance
      ? "bg-accent text-accent-foreground"
      : "bg-muted text-foreground",
    inputEditorClassName: appearanceState.isDarkAppearance
      ? "text-accent-foreground"
      : "text-foreground",
  }),
}));

import { MessageBubble } from "./shared";

describe("MessageBubble", () => {
  beforeEach(() => {
    cleanup();
    appearanceState.isDarkAppearance = true;
  });

  it("uses contrasting tokens for assistant bubbles on dark chat surfaces", () => {
    const { container } = render(
      <MessageBubble variant="assistant">Hello</MessageBubble>,
    );

    const bubble = container.firstChild as HTMLElement;

    expect(bubble.className).toContain("text-[13px]");
    expect(bubble.className).toContain("leading-5");
    expect(bubble.className).toContain("text-accent-foreground");
    expect(bubble.className).not.toContain("bg-card/95");
    expect(bubble.className).not.toContain("text-foreground");
  });

  it("gives loading bubbles a visible muted surface on light chat", () => {
    appearanceState.isDarkAppearance = false;

    const { container } = render(
      <MessageBubble variant="loading">Thinking...</MessageBubble>,
    );

    const bubble = container.firstChild as HTMLElement;

    expect(bubble.className).toContain("bg-background");
    expect(bubble.className).toContain("text-foreground");
    expect(bubble.className).toContain("border");
    expect(bubble.className).toContain("rounded-2xl");
  });

  it("keeps dark text on light-blue user bubbles", () => {
    const { container } = render(
      <MessageBubble variant="user">Hello</MessageBubble>,
    );

    const bubble = container.firstChild as HTMLElement;

    expect(bubble.className).toContain("bg-blue-100");
    expect(bubble.className).toContain("text-neutral-800");
    expect(bubble.className).not.toContain("text-foreground");
  });
});
