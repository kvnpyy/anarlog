import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FloatingActionButton } from "./index";

import type { Tab } from "~/store/zustand/tabs";
import type { EditorView } from "~/store/zustand/tabs/schema";

describe("FloatingActionButton", () => {
  const tab = {
    type: "sessions",
    id: "session-1",
    active: true,
    pinned: false,
    slotId: "slot-1",
    state: { view: null, autoStart: null },
  } as Extract<Tab, { type: "sessions" }>;

  const renderFloatingActionButton = (
    props: Partial<React.ComponentProps<typeof FloatingActionButton>> = {},
  ) =>
    render(
      <FloatingActionButton
        currentView={{ type: "raw" } as EditorView}
        tab={tab}
        {...props}
      />,
    );

  afterEach(() => {
    cleanup();
  });

  it("reserves space for the static chat composer instead of a pill", () => {
    renderFloatingActionButton();

    expect(
      screen.queryByRole("button", { name: "Ask Acorn anything" }),
    ).toBeNull();
    expect(
      document.querySelector("[data-session-chat-input-spacer]"),
    ).toBeTruthy();
  });

  it("keeps a selection slot stacked above the static composer", () => {
    renderFloatingActionButton();

    const slot = document.querySelector("[data-session-fab-selection]");
    const stack = slot?.parentElement;

    expect(stack?.className).toContain("flex-col-reverse");
    expect(stack?.className).toContain("bottom-3");
    expect(slot?.className).toContain("mb-2");
    expect(slot?.className).not.toContain("translate-y-8");
  });
});
