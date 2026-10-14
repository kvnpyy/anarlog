import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStoredSettingValues: vi.fn(),
  setSettingValues: vi.fn(),
  getAcornDefaultLlm: vi.fn(),
}));

vi.mock("~/settings/queries", () => ({
  getStoredSettingValues: mocks.getStoredSettingValues,
  setSettingValues: mocks.setSettingValues,
}));

vi.mock("~/shared/acorn-defaults", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/shared/acorn-defaults")>();
  return {
    ...actual,
    getAcornDefaultLlm: mocks.getAcornDefaultLlm,
  };
});

import { extendAcornPro, setAcornProEntitlement } from "./acorn-pro";

import {
  ACORN_HOSTED_HAIKU_MODEL,
  ACORN_HOSTED_SONNET_MODEL,
} from "~/shared/acorn-defaults";

describe("setAcornProEntitlement", () => {
  beforeEach(() => {
    mocks.getStoredSettingValues.mockReset().mockResolvedValue({
      values: {
        current_llm_provider: "acorn",
        current_llm_model: ACORN_HOSTED_HAIKU_MODEL,
      },
      hasValues: new Set(["current_llm_provider", "current_llm_model"]),
    });
    mocks.setSettingValues.mockReset().mockResolvedValue(undefined);
    mocks.getAcornDefaultLlm.mockReset().mockReturnValue({
      providerId: "acorn",
      kind: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "acorn-hosted",
      model: ACORN_HOSTED_HAIKU_MODEL,
    });
  });

  it("enables Pro and upgrades hosted Default AI", async () => {
    await setAcornProEntitlement(true, "invite");

    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      acorn_pro: true,
      acorn_pro_source: "invite",
      acorn_pro_expires_at: "",
      current_llm_model: ACORN_HOSTED_SONNET_MODEL,
    });
  });

  it("disables Pro and clamps hosted Default AI back to Haiku", async () => {
    mocks.getStoredSettingValues.mockResolvedValue({
      values: {
        current_llm_provider: "acorn",
        current_llm_model: ACORN_HOSTED_SONNET_MODEL,
        acorn_pro_source: "invite",
      },
      hasValues: new Set([
        "current_llm_provider",
        "current_llm_model",
        "acorn_pro_source",
      ]),
    });

    await setAcornProEntitlement(false);

    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      acorn_pro: false,
      acorn_pro_source: "",
      acorn_pro_expires_at: "",
      current_llm_model: ACORN_HOSTED_HAIKU_MODEL,
    });
  });

  it("leaves a custom LLM provider unchanged", async () => {
    mocks.getStoredSettingValues.mockResolvedValue({
      values: {
        current_llm_provider: "openai",
        current_llm_model: "gpt-4o",
      },
      hasValues: new Set(["current_llm_provider", "current_llm_model"]),
    });

    await setAcornProEntitlement(true, "dev");

    expect(mocks.setSettingValues).toHaveBeenCalledWith({
      acorn_pro: true,
      acorn_pro_source: "dev",
      acorn_pro_expires_at: "",
    });
  });
});

describe("extendAcornPro", () => {
  const nowMs = Date.parse("2026-10-14T12:00:00.000Z");
  const day = 86_400_000;

  beforeEach(() => {
    mocks.setSettingValues.mockReset().mockResolvedValue(undefined);
    mocks.getAcornDefaultLlm.mockReset().mockReturnValue(null);
  });

  function stored(values: Record<string, unknown>) {
    mocks.getStoredSettingValues.mockReset().mockResolvedValue({
      values,
      hasValues: new Set(Object.keys(values)),
    });
  }

  it("starts from now on Free", async () => {
    stored({ acorn_pro: false });

    await expect(extendAcornPro("linkedin", 30, nowMs)).resolves.toBe(
      new Date(nowMs + 30 * day).toISOString(),
    );
  });

  it("adds onto Pro time already left", async () => {
    stored({
      acorn_pro: true,
      acorn_pro_expires_at: new Date(nowMs + 90 * day).toISOString(),
    });

    await expect(extendAcornPro("linkedin", 30, nowMs)).resolves.toBe(
      new Date(nowMs + 120 * day).toISOString(),
    );
  });

  it("ignores an expiry that already passed", async () => {
    stored({
      acorn_pro: true,
      acorn_pro_expires_at: new Date(nowMs - 5 * day).toISOString(),
    });

    await expect(extendAcornPro("share", 90, nowMs)).resolves.toBe(
      new Date(nowMs + 90 * day).toISOString(),
    );
  });

  it("leaves unlimited Pro alone", async () => {
    stored({ acorn_pro: true, acorn_pro_expires_at: "" });

    await expect(extendAcornPro("linkedin", 30, nowMs)).resolves.toBeNull();
    expect(mocks.setSettingValues).not.toHaveBeenCalled();
  });
});
