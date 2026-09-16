import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStoredSettingValues: vi.fn(),
  setSettingValues: vi.fn(),
  setAcornProEntitlement: vi.fn(),
  acornRegisterShareCode: vi.fn(),
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
    acornRequestShareVerify: mocks.acornRequestShareVerify,
    acornConfirmShareVerify: mocks.acornConfirmShareVerify,
    acornShareStatus: mocks.acornShareStatus,
  },
}));

import {
  confirmShareVerify,
  createShareCode,
  ensureShareCode,
  requestShareVerify,
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
    expect(shareMessage("aaaaaaaaaaaaaaaaaaaaaaaa")).not.toContain(
      "https://useacorn.app\n",
    );
    expect(createShareCode()).toMatch(/^[a-f0-9]{24}$/);
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
