import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: vi.fn(() => "macos"),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: mocks.platform,
}));

import { AppSettingsView, AcornProSettingsCard } from "./app-settings";

function setting(value = true) {
  return {
    value,
    onChange: vi.fn(),
  };
}

function renderAppSettings({
  appStoreBuild = false,
  automaticUpdates = setting(),
} = {}) {
  return {
    ...render(
      <AppSettingsView
        appStoreBuild={appStoreBuild}
        autostart={setting()}
        automaticUpdates={automaticUpdates}
        showAppInDock={setting()}
        showTrayIcon={setting()}
      />,
    ),
    automaticUpdates,
  };
}

describe("AppSettingsView", () => {
  afterEach(() => {
    cleanup();
    mocks.platform.mockReturnValue("macos");
  });

  it("lets switch descriptions use the available row width", () => {
    renderAppSettings();

    expect(
      screen.getByRole("switch", { name: "Start Acorn at login" }).parentElement
        ?.className,
    ).not.toContain("w-48");
  });

  it("hides macOS-only Dock controls outside macOS", () => {
    mocks.platform.mockReturnValue("windows");
    renderAppSettings();

    expect(
      screen.queryByRole("switch", { name: "Show app in Dock" }),
    ).toBeNull();
    expect(screen.queryByText("Open Acorn from the menu bar.")).toBeNull();
    expect(screen.getByRole("switch", { name: "Show tray icon" })).toBeTruthy();
  });

  it("toggles automatic updates", () => {
    const automaticUpdates = setting(false);
    renderAppSettings({ automaticUpdates });

    fireEvent.click(
      screen.getByRole("switch", { name: "Automatically install updates" }),
    );

    expect(automaticUpdates.onChange).toHaveBeenCalledWith(true);
    expect(
      screen.getByText(/installed the next time Acorn opens/),
    ).toBeTruthy();
  });

  it("hides direct-distribution controls in App Store builds", () => {
    renderAppSettings({ appStoreBuild: true });

    expect(
      screen.queryByRole("switch", { name: "Start Acorn at login" }),
    ).toBeNull();
    expect(
      screen.queryByRole("switch", { name: "Automatically install updates" }),
    ).toBeNull();
  });

  it("keeps cloud sync in its dedicated settings page", () => {
    renderAppSettings();

    expect(screen.queryByRole("switch", { name: "Cloud sync" })).toBeNull();
  });

  it("keeps telemetry in its dedicated privacy page", () => {
    renderAppSettings();

    expect(
      screen.queryByRole("switch", { name: "Share usage data (PostHog)" }),
    ).toBeNull();
    expect(screen.queryByRole("switch", { name: "Sentry" })).toBeNull();
  });

  it("shows About and license attribution", () => {
    renderAppSettings();

    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByText("Local meeting notes. Live Ask.")).toBeTruthy();
    expect(screen.getByText("Acorn is built on Anarlog (MIT).")).toBeTruthy();
    expect(
      screen.getByText(/Copyright \(c\) 2023-present Fastrepl, Inc./),
    ).toBeTruthy();
    expect(screen.getByText(/MIT License/)).toBeTruthy();
  });
});

describe("AcornProSettingsCard", () => {
  afterEach(cleanup);

  it("shows Free vs Pro copy and an inert upgrade action", () => {
    const onUpgrade = vi.fn();
    render(<AcornProSettingsCard isPro={false} onUpgrade={onUpgrade} />);

    expect(screen.getByRole("heading", { name: "Acorn Pro" })).toBeTruthy();
    expect(screen.getByText(/AI memory: 14 days vs 365 days/)).toBeTruthy();
    expect(
      screen.getByText(/Teams & shared notes: coming on Pro/),
    ).toBeTruthy();
    expect(screen.getByText(/CLI, MCP & webhooks: coming on Pro/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Acorn Pro" }));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });
});
