import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAcornProEntitlement: vi.fn(),
  acornConsumeProInvite: vi.fn(),
}));

vi.mock("./acorn-pro", () => ({
  setAcornProEntitlement: mocks.setAcornProEntitlement,
}));

vi.mock("~/types/tauri.gen", () => ({
  commands: {
    acornConsumeProInvite: mocks.acornConsumeProInvite,
  },
}));

import {
  hashAcornProInviteCode,
  matchesAcornProInviteHash,
  normalizeAcornProInviteCode,
  redeemAcornProInvite,
} from "./acorn-pro-invite";

describe("acorn Pro invite codes", () => {
  beforeEach(() => {
    mocks.setAcornProEntitlement.mockReset().mockResolvedValue(undefined);
    mocks.acornConsumeProInvite.mockReset().mockResolvedValue({
      status: "ok",
      data: "ok",
    });
  });

  it("normalizes spacing, dashes, and case", () => {
    expect(normalizeAcornProInviteCode(" acorn-ab12-cd34 ")).toBe(
      "ACORNAB12CD34",
    );
  });

  it("accepts a hashed invite and rejects unknown codes", async () => {
    const code = "ACORN-TEST-CODE-0001";
    const hashes = new Set([await hashAcornProInviteCode(code)]);

    expect(await matchesAcornProInviteHash(code, hashes)).toBe(true);
    expect(
      await matchesAcornProInviteHash("acorn-test-code-0001", hashes),
    ).toBe(true);
    expect(
      await matchesAcornProInviteHash("ACORN-NOPE-CODE-0001", hashes),
    ).toBe(false);
    expect(await matchesAcornProInviteHash("short", hashes)).toBe(false);
  });

  it("redeems a valid invite once", async () => {
    const code = "ACORN-TEST-CODE-0001";
    const hashes = new Set([await hashAcornProInviteCode(code)]);

    expect(await redeemAcornProInvite(code, false, hashes)).toBe("ok");
    expect(mocks.setAcornProEntitlement).toHaveBeenCalledWith(true, "invite");

    expect(await redeemAcornProInvite(code, true, hashes)).toBe("already_pro");
    expect(mocks.setAcornProEntitlement).toHaveBeenCalledTimes(1);

    expect(await redeemAcornProInvite("ACORN-NOPE", false, hashes)).toBe(
      "invalid",
    );
    expect(mocks.acornConsumeProInvite).toHaveBeenCalledTimes(1);
  });

  it("rejects a code that was already redeemed", async () => {
    const code = "ACORN-TEST-CODE-0001";
    const hashes = new Set([await hashAcornProInviteCode(code)]);
    mocks.acornConsumeProInvite.mockResolvedValue({
      status: "ok",
      data: "used",
    });

    expect(await redeemAcornProInvite(code, false, hashes)).toBe("used");
    expect(mocks.setAcornProEntitlement).not.toHaveBeenCalled();
  });

  it("does not treat the test fixture as a production invite", async () => {
    expect(await matchesAcornProInviteHash("ACORN-TEST-CODE-0001")).toBe(false);
  });
});
