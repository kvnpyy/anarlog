import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIdentifier: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getIdentifier: mocks.getIdentifier,
}));

import {
  buildWebAppUrl,
  getScheme,
  hostedDesktopWebFlowsEnabled,
} from "./utils";

describe("getScheme", () => {
  beforeEach(() => {
    mocks.getIdentifier.mockReset();
  });

  it.each([
    ["com.hyprnote.stable", "anarlog"],
    ["com.hyprnote.Hyprnote", "anarlog"],
    ["com.hyprnote.staging", "anarlog-staging"],
    ["com.hyprnote.dev", "anarlog-dev"],
    ["so.anarlog.Anarlog", "anarlog"],
    ["unknown", "anarlog"],
  ])("maps %s to %s", async (identifier, scheme) => {
    mocks.getIdentifier.mockResolvedValue(identifier);

    await expect(getScheme()).resolves.toBe(scheme);
  });
});

describe("buildWebAppUrl", () => {
  beforeEach(() => {
    mocks.getIdentifier.mockReset();
    mocks.getIdentifier.mockResolvedValue("com.hyprnote.dev");
  });

  it("treats the default localhost web app as unavailable in local-only mode", () => {
    expect(hostedDesktopWebFlowsEnabled()).toBe(false);
  });

  it("does not open localhost auth or integration URLs in local-only mode", async () => {
    await expect(buildWebAppUrl("/auth")).rejects.toThrow(/local-only/);
    await expect(
      buildWebAppUrl("/app/integration", {
        action: "connect",
        integration_id: "google-calendar",
      }),
    ).rejects.toThrow(/local-only/);
  });

  it("still blocks billing URLs in local-only mode", async () => {
    await expect(buildWebAppUrl("/app/checkout")).rejects.toThrow(/local-only/);
    await expect(buildWebAppUrl("/app/portal")).rejects.toThrow(/local-only/);
  });
});
