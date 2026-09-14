import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveAskRail } from "./live-ask-rail";

import {
  LIVE_ASK_CATCH_UP_WINDOW_MS,
  LIVE_ASK_TRANSCRIPT_WINDOW_MS,
} from "~/chat/context/live-transcript-snippet";

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
    expect(onSendMessage.mock.calls[0]?.[3]).toContain('no "You:" line');
    expect(onSendMessage.mock.calls[0]?.[3]).toContain(
      "do not write as if they spoke",
    );
    expect(onSendMessage.mock.calls[0]?.[3]).toContain(
      "only if they are in a position to speak",
    );
    expect(onSendMessage.mock.calls[0]?.[4]).toBe(LIVE_ASK_CATCH_UP_WINDOW_MS);
    expect(onSendMessage.mock.calls[1]?.[0]).toBe("Sound smart");
    expect(onSendMessage.mock.calls[1]?.[3]).toContain("sound smart");
    expect(onSendMessage.mock.calls[1]?.[3]).toContain(
      "Do not claim I already said them",
    );
    expect(onSendMessage.mock.calls[1]?.[4]).toBe(
      LIVE_ASK_TRANSCRIPT_WINDOW_MS,
    );
    expect(onSendMessage.mock.calls[2]?.[0]).toBe("Draft email");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("follow-up email");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("under 250 words");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("bullet points");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("in my voice");
    expect(onSendMessage.mock.calls[2]?.[4]).toBeUndefined();
  });

  it("centers the Ask recipe pills above the composer", () => {
    const { container } = render(
      <LiveAskRail isBatchOnly={false} onSendMessage={vi.fn()} />,
    );
    const rail = container.querySelector("[data-live-ask-rail]");
    const row = rail?.querySelector("div.flex");

    expect(rail?.className).toContain("px-1");
    expect(row?.className).toContain("justify-center");
    expect(
      screen.getByRole("button", { name: "Draft email" }).className,
    ).toContain("px-3");
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

  it("offers post-meeting recipes instead of live-call coaching", () => {
    const onSendMessage = vi.fn();

    render(
      <LiveAskRail
        variant="past"
        isBatchOnly={false}
        onSendMessage={onSendMessage}
      />,
    );

    expect(screen.queryByRole("button", { name: "Catch me up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sound smart" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Draft email" }));
    fireEvent.click(screen.getByRole("button", { name: "Action items" }));
    fireEvent.click(screen.getByRole("button", { name: "Key decisions" }));

    expect(onSendMessage).toHaveBeenCalledTimes(3);
    expect(onSendMessage.mock.calls[0]?.[3]).toContain("follow-up email");
    expect(onSendMessage.mock.calls[0]?.[3]).toContain("under 250 words");
    expect(onSendMessage.mock.calls[0]?.[3]).not.toContain("so far");
    expect(onSendMessage.mock.calls[1]?.[0]).toBe("Action items");
    expect(onSendMessage.mock.calls[1]?.[3]).toContain("action items");
    expect(onSendMessage.mock.calls[2]?.[0]).toBe("Key decisions");
    expect(onSendMessage.mock.calls[2]?.[3]).toContain("key decisions");
  });
});
