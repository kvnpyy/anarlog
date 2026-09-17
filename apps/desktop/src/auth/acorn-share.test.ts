import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStoredSettingValues: vi.fn(),
  setSettingValues: vi.fn(),
  setAcornProEntitlement: vi.fn(),
  acornRegisterShareCode: vi.fn(),
  acornSendShareInvites: vi.fn(),
  acornRequestShareVerify: vi.fn(),
  acornConfirmShareVerify: vi.fn(),
  acornShareStatus: vi.fn(),
}));

vi.mock("~/settings/queries", () => ({
  getStoredSettingValues: mocks.getStoredSettingValues,
  setSettingValues: mocks.setSettingValues,
}));

vi.mock("./acorn-pro", () => ({
  setAcornProEntitlement: mocks.setAcornProEntitlement,
}));

vi.mock("~/types/tauri.gen", () => ({
  commands: {
    acornRegisterShareCode: mocks.acornRegisterShareCode,
    acornSendShareInvites: mocks.acornSendShareInvites,
    acornRequestShareVerify: mocks.acornRequestShareVerify,
    acornConfirmShareVerify: mocks.acornConfirmShareVerify,
    acornShareStatus: mocks.acornShareStatus,
  },
}));

import {
  confirmShareVerify,
  createShareCode,
  ensureShareCode,
  formatShareCode,
  normalizeShareCode,
  parseInviteEmails,
  requestShareVerify,
  sendShareInvites,
  shareMessage,
  shareUrl,
  syncShareReferrerGrant,
} from "./acorn-share";

describe("acorn share codes", () => {
  beforeEach(() => {
    mocks.getStoredSettingValues.mockReset().mockResolvedValue({
      values: {
        acorn_share_code: "",
        acorn_share_email: "",
        acorn_pro: false,
      },
    });
    mocks.setSettingValues.mockReset().mockResolvedValue(undefined);
    mocks.setAcornProEntitlement.mockReset().mockResolvedValue(undefined);
    mocks.acornRegisterShareCode.mockReset().mockResolvedValue({
      status: "ok",
      data: "ok",
    });
    mocks.acornSendShareInvites.mockReset().mockResolvedValue({
      status: "ok",
      data: {
        sent: ["ada@yotpo.com"],
        failed: [],
      },
    });
    mocks.acornRequestShareVerify.mockReset().mockResolvedValue({
      status: "ok",
      data: { status: "sent", qualified_count: 0, granted_referrer: false },
    });
    mocks.acornConfirmShareVerify.mockReset().mockResolvedValue({
      status: "ok",
      data: { status: "ok", qualified_count: 1, granted_referrer: false },
    });
    mocks.acornShareStatus.mockReset().mockResolvedValue({
      status: "ok",
      data: {
        code: "aaaaaaaaaaaaaaaaaaaaaaaa",
        qualified_count: 2,
        granted: true,
      },
    });
  });

  it("builds useacorn.app share URLs", () => {
    expect(shareUrl("aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "https://useacorn.app/r/aaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(shareMessage("aaaaaaaaaaaaaaaaaaaaaaaa")).toContain(
      "https://useacorn.app/r/aaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(shareMessage("aaaaaaaaaaaaaaaaaaaaaaaa")).toContain(
      "Share code: aaaa-aaaa-aaaa-aaaa-aaaa-aaaa",
    );
    expect(createShareCode()).toMatch(/^[a-f0-9]{24}$/);
  });

  it("formats dashed codes and skips the referrer mailbox", () => {
    expect(formatShareCode("aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "aaaa-aaaa-aaaa-aaaa-aaaa-aaaa",
    );
    expect(normalizeShareCode("AAAA-aaaa-AAAA-aaaa-AAAA-aaaa")).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(
      parseInviteEmails(
        "Ada@Yotpo.com, kevin@yotpo.com sam@yotpo.com",
        "Kevin+share@Yotpo.com",
      ),
    ).toEqual(["ada@yotpo.com", "sam@yotpo.com"]);
  });

  it("registers a share code for the local user", async () => {
    const code = await ensureShareCode("Kevin+share@Yotpo.com");
    expect(code).toMatch(/^[a-f0-9]{24}$/);
    expect(mocks.acornRegisterShareCode).toHaveBeenCalledWith(
      code,
      "kevin@yotpo.com",
    );
    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      acorn_share_code: code,
      acorn_share_email: "kevin@yotpo.com",
    });
  });

  it("emails invitees and still returns the code if delivery fails", async () => {
    await expect(
      sendShareInvites("kevin@yotpo.com", ["ada@yotpo.com", "kevin@yotpo.com"]),
    ).resolves.toEqual({
      code: expect.stringMatching(/^[a-f0-9]{24}$/),
      sent: ["ada@yotpo.com"],
      failed: [],
    });
    expect(mocks.acornSendShareInvites).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{24}$/),
      ["ada@yotpo.com"],
    );

    mocks.acornSendShareInvites.mockResolvedValue({
      status: "error",
      error: "Invite email isn’t configured on this build.",
    });
    const failed = await sendShareInvites("kevin@yotpo.com", ["ada@yotpo.com"]);
    expect(failed.sent).toEqual([]);
    expect(failed.failed).toEqual(["ada@yotpo.com"]);
    expect(failed.emailError).toContain("Invite email isn’t configured");
    expect(failed.code).toMatch(/^[a-f0-9]{24}$/);
  });

  it("rejects personal inboxes and waits for work-email confirmation", async () => {
    await expect(
      requestShareVerify("aaaaaaaaaaaaaaaaaaaaaaaa", "a@gmail.com"),
    ).resolves.toBe("personal");
    await expect(
      requestShareVerify("aaaaaaaaaaaaaaaaaaaaaaaa", "sam@yotpo.com"),
    ).resolves.toBe("sent");
    expect(mocks.setAcornProEntitlement).not.toHaveBeenCalled();

    await expect(
      confirmShareVerify("aaaaaaaaaaaaaaaaaaaaaaaa", "sam@yotpo.com", "123456"),
    ).resolves.toBe("ok");
    expect(mocks.setAcornProEntitlement).toHaveBeenCalledWith(
      true,
      "share_invitee",
      expect.any(String),
    );
  });

  it("grants the referrer a year after two installs", async () => {
    mocks.getStoredSettingValues.mockResolvedValue({
      values: {
        acorn_share_code: "aaaaaaaaaaaaaaaaaaaaaaaa",
        acorn_pro: false,
      },
    });

    await expect(syncShareReferrerGrant()).resolves.toBe(true);
    expect(mocks.setAcornProEntitlement).toHaveBeenCalledWith(
      true,
      "share",
      expect.any(String),
    );
  });
});
