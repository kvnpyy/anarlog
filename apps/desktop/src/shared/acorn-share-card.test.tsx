import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestShareVerify: vi.fn(),
  confirmShareVerify: vi.fn(),
  loadShareStatus: vi.fn(),
  sendShareInvites: vi.fn(),
  syncShareReferrerGrant: vi.fn(),
  writeClipboardText: vi.fn(),
  config: {
    acorn_share_code: "",
    acorn_share_email: "",
  },
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: mocks.writeClipboardText,
}));

vi.mock("~/auth/acorn-share", async () => {
  const actual =
    await vi.importActual<typeof import("~/auth/acorn-share")>(
      "~/auth/acorn-share",
    );
  return {
    ...actual,
    requestShareVerify: mocks.requestShareVerify,
    confirmShareVerify: mocks.confirmShareVerify,
    loadShareStatus: mocks.loadShareStatus,
    sendShareInvites: mocks.sendShareInvites,
    syncShareReferrerGrant: mocks.syncShareReferrerGrant,
  };
});

vi.mock("~/shared/config", () => ({
  useConfigValues: () => mocks.config,
}));

import { AcornShareCard } from "./acorn-share-card";

describe("AcornShareCard", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.config.acorn_share_code = "";
    mocks.config.acorn_share_email = "";
    mocks.requestShareVerify.mockReset().mockResolvedValue("sent");
    mocks.confirmShareVerify.mockReset().mockResolvedValue("ok");
    mocks.loadShareStatus.mockReset().mockResolvedValue({
      qualifiedCount: 0,
      granted: false,
    });
    mocks.sendShareInvites.mockReset().mockResolvedValue({
      code: "aaaaaaaaaaaaaaaaaaaaaaaa",
      sent: ["ada@yotpo.com"],
      failed: [],
    });
    mocks.syncShareReferrerGrant.mockReset();
    mocks.writeClipboardText.mockReset().mockResolvedValue(undefined);
  });

  it("emails invitees and shows a backup code without using the web clipboard", async () => {
    render(<AcornShareCard />);

    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "kevin@yotpo.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("ada@company.com, sam@company.com"),
      { target: { value: "ada@yotpo.com" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send invites" }));

    await waitFor(() => {
      expect(screen.getByText("aaaa-aaaa-aaaa-aaaa-aaaa-aaaa")).toBeTruthy();
    });
    expect(mocks.sendShareInvites).toHaveBeenCalledWith("kevin@yotpo.com", [
      "ada@yotpo.com",
    ]);
    expect(
      screen.getByText(
        "Emailed ada@yotpo.com. If they don’t see it, send them the code below.",
      ),
    ).toBeTruthy();
    expect(mocks.writeClipboardText).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await waitFor(() => {
      expect(mocks.writeClipboardText).toHaveBeenCalledWith(
        "aaaa-aaaa-aaaa-aaaa-aaaa-aaaa",
      );
    });
  });

  it("still shows the code when invite email delivery fails", async () => {
    mocks.sendShareInvites.mockResolvedValue({
      code: "bbbbbbbbbbbbbbbbbbbbbbbb",
      sent: [],
      failed: ["ada@yotpo.com"],
      emailError: "Couldn’t send those invites. Share the code instead.",
    });
    render(<AcornShareCard />);

    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "kevin@yotpo.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("ada@company.com, sam@company.com"),
      { target: { value: "ada@yotpo.com" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send invites" }));

    await waitFor(() => {
      expect(screen.getByText("bbbb-bbbb-bbbb-bbbb-bbbb-bbbb")).toBeTruthy();
    });
    expect(
      screen.getByText("Couldn’t send those invites. Share the code instead."),
    ).toBeTruthy();
    expect(
      screen.getByText("Share the code below if they don’t get an email."),
    ).toBeTruthy();
  });

  it("asks them to confirm the work inbox before granting Pro", async () => {
    render(<AcornShareCard />);

    fireEvent.change(screen.getByPlaceholderText("Share code"), {
      target: { value: "aaaaaaaaaaaaaaaaaaaaaaaa" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email"), {
      target: { value: "sam@yotpo.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(/We sent a code to sam@yotpo.com/),
      ).toBeTruthy();
    });
    expect(mocks.requestShareVerify).toHaveBeenCalledWith(
      "aaaaaaaaaaaaaaaaaaaaaaaa",
      "sam@yotpo.com",
    );
    expect(mocks.confirmShareVerify).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("6-digit code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm email" }));

    await waitFor(() => {
      expect(
        screen.getByText("You have 30 days of Pro on this Mac."),
      ).toBeTruthy();
    });
    expect(mocks.confirmShareVerify).toHaveBeenCalledWith(
      "aaaaaaaaaaaaaaaaaaaaaaaa",
      "sam@yotpo.com",
      "123456",
    );
  });
});
