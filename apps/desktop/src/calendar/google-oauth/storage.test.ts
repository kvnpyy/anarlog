import { beforeEach, describe, expect, test, vi } from "vitest";

const store = vi.hoisted(() => ({
  getStr: vi.fn(),
  setStr: vi.fn(),
  getSecret: vi.fn(),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

vi.mock("@anlg/plugin-store2", () => ({
  commands: store,
}));

import {
  deleteGoogleCalendarConnection,
  saveGoogleCalendarConnection,
  toConnectionItem,
} from "./storage";

describe("Google Calendar OAuth storage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    store.getStr.mockResolvedValue({ status: "ok", data: null });
    store.setStr.mockResolvedValue({ status: "ok", data: null });
    store.getSecret.mockResolvedValue({ status: "ok", data: null });
    store.setSecret.mockResolvedValue({ status: "ok", data: null });
    store.deleteSecret.mockResolvedValue({ status: "ok", data: null });
  });

  test("stores tokens in the keychain without a client secret", async () => {
    const credential = {
      type: "oauth" as const,
      refresh: "refresh-token",
      access: "access-token",
      expires: Date.now() + 60_000,
    };

    const connection = await saveGoogleCalendarConnection({
      email: "user@example.com",
      credential,
    });

    expect(store.setSecret).toHaveBeenCalledWith(
      "google-calendar-oauth",
      connection.connection_id,
      JSON.stringify(credential),
    );
    expect(JSON.stringify(credential)).not.toContain("client_secret");
    expect(store.setStr).toHaveBeenCalledWith(
      "google-calendar",
      "connections",
      expect.stringContaining("user@example.com"),
    );
    expect(toConnectionItem(connection)).toMatchObject({
      integration_id: "google-calendar",
      account_identity: "user@example.com",
      status: "ok",
    });
  });

  test("reuses an existing connection when the same Google account reconnects", async () => {
    store.getStr.mockResolvedValue({
      status: "ok",
      data: JSON.stringify([
        {
          connection_id: "conn-1",
          email: "user@example.com",
          status: "reconnect_required",
        },
      ]),
    });

    const connection = await saveGoogleCalendarConnection({
      email: "user@example.com",
      credential: {
        type: "oauth",
        refresh: "refresh-2",
        access: "access-2",
        expires: Date.now() + 60_000,
      },
    });

    expect(connection.connection_id).toBe("conn-1");
    expect(connection.status).toBe("ok");
  });

  test("removes connection metadata and the keychain secret", async () => {
    store.getStr.mockResolvedValue({
      status: "ok",
      data: JSON.stringify([
        {
          connection_id: "conn-1",
          email: "user@example.com",
          status: "ok",
        },
      ]),
    });

    await deleteGoogleCalendarConnection("conn-1");

    expect(store.deleteSecret).toHaveBeenCalledWith(
      "google-calendar-oauth",
      "conn-1",
    );
    expect(store.setStr).toHaveBeenCalledWith(
      "google-calendar",
      "connections",
      "[]",
    );
  });
});
