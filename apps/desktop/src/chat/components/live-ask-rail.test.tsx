import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveAskRail } from "./live-ask-rail";

describe("LiveAskRail", () => {
  beforeEach(() => {
    cleanup();
  });

  it("sends recipe prompts from the three Ask buttons", () => {
    const onSendMessage = vi.fn();

    render(<LiveAskRail isBatchOnly={false} onSendMessage={onSendMessage} />);

    fireEvent.click(screen.getByRole("button", { name: "Catch me up" }));
    fireEvent.click(screen.getByRole("button", { name: "Sound smart" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft email" }));

    expect(onSendMessage).toHaveBeenCalledTimes(3);
    expect(onSendMessage.mock.calls[0]?.[0]).toBe("Catch me up");
    expect(onSendMessage.mock.calls[0]?.[1]).toEqual([
      { type: "text", text: "Catch me up" },
    ]);
    expect(onSendMessage.mock.calls[0]?.[3]).toContain(
      "Catch me up on this meeting",
    );
    expect(onSendMessage.mock.calls[0]?.[3]).toContain("last 5 minutes");
    expect(onSendMessage.mock.calls[0]?.[3]).toContain("3-5 short bullets");
    expect(onSendMessage.mock.calls[1]?.[0]).toBe("Sound smart");
    expect(onSendMessage.mock.calls[1]?.[3]).toContain("sound smart");
    expect(onSendMessage.mock.calls[2]?.[0]).toBe("Draft email");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("follow-up email");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("plain text");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("in my voice");
  });

  it("warns that live ask needs a live STT model during batch-only capture", () => {
    const onSendMessage = vi.fn();

    render(<LiveAskRail isBatchOnly onSendMessage={onSendMessage} />);

    expect(screen.getByRole("status").textContent).toContain(
      "Live Ask needs a live transcription model",
    );
    expect(screen.getByRole("status").textContent).toContain("Deepgram Nova 3");
    expect(
      (screen.getByRole("button", { name: "Catch me up" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Catch me up" }));
    expect(onSendMessage).not.toHaveBeenCalled();
  });
});
