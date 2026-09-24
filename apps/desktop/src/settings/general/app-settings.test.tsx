import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVersion: vi.fn(() => Promise.resolve("0.1.19")),
  platform: vi.fn(() => "macos"),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: mocks.getVersion,
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: mocks.platform,
}));

import { AppSettingsView } from "./app-settings";

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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    ...render(
      <AppSettingsView
        appStoreBuild={appStoreBuild}
        autostart={setting()}
        automaticUpdates={automaticUpdates}
        showAppInDock={setting()}
        showTrayIcon={setting()}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      },
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

  it("keeps Pro sharing on its dedicated settings page", () => {
    renderAppSettings();

    expect(screen.queryByText("Share Acorn, get 3 months of Pro")).toBeNull();
    expect(screen.queryByLabelText("Have a Pro invite?")).toBeNull();
  });

  it("shows About and license attribution", async () => {
    renderAppSettings();

    expect(screen.getByText("About")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Version 0.1.19")).toBeTruthy();
    });
    expect(screen.getByText("Local meeting notes. Live Ask.")).toBeTruthy();
    expect(screen.getByText("Acorn is built on Anarlog (MIT).")).toBeTruthy();
    expect(
      screen.getByText(/Copyright \(c\) 2023-present Fastrepl, Inc./),
    ).toBeTruthy();
    expect(screen.getByText(/MIT License/)).toBeTruthy();
  });
});
