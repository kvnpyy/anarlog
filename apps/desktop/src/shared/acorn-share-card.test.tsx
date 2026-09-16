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
  ensureShareCode: vi.fn(),
  syncShareReferrerGrant: vi.fn(),
  shareMessage: vi.fn((code: string) => `share:${code}`),
}));

vi.mock("~/auth/acorn-share", () => ({
  SHARE_QUALIFYING_INSTALLS: 2,
  requestShareVerify: mocks.requestShareVerify,
  confirmShareVerify: mocks.confirmShareVerify,
  loadShareStatus: mocks.loadShareStatus,
  ensureShareCode: mocks.ensureShareCode,
  syncShareReferrerGrant: mocks.syncShareReferrerGrant,
  shareMessage: mocks.shareMessage,
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: () => ({
    acorn_share_code: "",
    acorn_share_email: "",
  }),
}));

import { AcornShareCard } from "./acorn-share-card";

describe("AcornShareCard", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.requestShareVerify.mockReset().mockResolvedValue("sent");
    mocks.confirmShareVerify.mockReset().mockResolvedValue("ok");
    mocks.loadShareStatus.mockReset();
    mocks.ensureShareCode.mockReset();
    mocks.syncShareReferrerGrant.mockReset();
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
