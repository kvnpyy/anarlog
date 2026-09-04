import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/chat/hooks/use-chat-appearance", () => ({
  useChatAppearance: () => ({
    isDarkAppearance: false,
  }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: () => vi.fn(),
}));

import { ChatBodyEmpty } from "./empty";

describe("ChatBodyEmpty", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders context suggestions as short list rows without intro copy", () => {
    const onSendMessage = vi.fn();

    render(<ChatBodyEmpty hasContext onSendMessage={onSendMessage} />);

    expect(screen.queryByText("Anarlog AI")).toBeNull();
    expect(screen.queryByText(/Hi, I'm Anarlog AI/i)).toBeNull();

    const actionItem = screen.getByRole("button", {
      name: "List action items.",
    });
    const followUp = screen.getByRole("button", {
      name: "Draft follow-up email.",
    });
    const decisions = screen.getByRole("button", {
      name: "Find key decisions.",
    });

    expect(actionItem.className).toContain("w-full");
    expect(actionItem.className).toContain("grid");
    expect(actionItem.className).toContain("grid-cols-[1.5rem_minmax(0,1fr)]");
    expect(actionItem.className).toContain("gap-x-1.5");
    expect(actionItem.className).toContain("hover:bg-muted/55");
    expect(actionItem.className).toContain("text-left");
    expect(actionItem.firstElementChild?.className).toContain("size-6");
    expect(followUp.className).toContain("w-full");
    expect(decisions.className).toContain("w-full");

    fireEvent.click(followUp);

    expect(onSendMessage).toHaveBeenCalledWith(
      "Draft follow-up email.",
      [
        {
          type: "text",
          text: "Draft follow-up email.",
        },
      ],
      undefined,
      expect.stringContaining("under 150 words"),
    );

    fireEvent.click(decisions);

    expect(onSendMessage).toHaveBeenCalledWith(
      "Find key decisions.",
      [
        {
          type: "text",
          text: "Find key decisions.",
        },
      ],
      undefined,
      "What were the key decisions that have been made?",
    );
  });

  it("offers workspace-wide prompts when no meeting is attached", () => {
    const onSendMessage = vi.fn();

    render(<ChatBodyEmpty onSendMessage={onSendMessage} />);

    expect(screen.getByText("Ask across all your meetings.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Catch me up on recent meetings." }),
    );

    expect(onSendMessage).toHaveBeenCalledWith(
      "Catch me up on recent meetings.",
      [
        {
          type: "text",
          text: "Catch me up on recent meetings.",
        },
      ],
      undefined,
      expect.stringContaining("Catch me up on my recent meetings"),
    );
  });
});
