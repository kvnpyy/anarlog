import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStoredSettingValues: vi.fn(),
  setSettingValues: vi.fn(),
  extendAcornPro: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock("~/settings/queries", () => ({
  getStoredSettingValues: mocks.getStoredSettingValues,
  setSettingValues: mocks.setSettingValues,
}));

vi.mock("./acorn-pro", () => ({
  extendAcornPro: mocks.extendAcornPro,
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));

import {
  grantLinkedInFollow,
  LINKEDIN_COMPANY_URL,
  openLinkedInCompanyPage,
} from "./acorn-linkedin";

describe("LinkedIn follow reward", () => {
  beforeEach(() => {
    mocks.getStoredSettingValues.mockReset().mockResolvedValue({
      values: { acorn_linkedin_granted_at: "" },
    });
    mocks.setSettingValues.mockReset().mockResolvedValue(undefined);
    mocks.extendAcornPro.mockReset().mockResolvedValue("2026-11-14");
    mocks.openUrl.mockReset().mockResolvedValue(undefined);
  });

  it("opens the Acorn company page", async () => {
    await openLinkedInCompanyPage();
    expect(mocks.openUrl).toHaveBeenCalledWith(
      "https://www.linkedin.com/company/useacorn/",
      null,
    );
    expect(LINKEDIN_COMPANY_URL).toBe(
      "https://www.linkedin.com/company/useacorn/",
    );
  });

  it("adds one month and records the claim", async () => {
    await expect(grantLinkedInFollow()).resolves.toBe(true);
    expect(mocks.extendAcornPro).toHaveBeenCalledWith("linkedin", 30);
    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      acorn_linkedin_granted_at: expect.any(String),
    });
  });

  it("grants only once", async () => {
    mocks.getStoredSettingValues.mockResolvedValue({
      values: { acorn_linkedin_granted_at: "2026-10-01T00:00:00.000Z" },
    });

    await expect(grantLinkedInFollow()).resolves.toBe(false);
    expect(mocks.extendAcornPro).not.toHaveBeenCalled();
  });

  it("does not double-grant on a double click", async () => {
    await Promise.all([grantLinkedInFollow(), grantLinkedInFollow()]);
    expect(mocks.extendAcornPro).toHaveBeenCalledOnce();
  });
});
