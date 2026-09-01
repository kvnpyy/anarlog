import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setSettingValues: vi.fn(),
  useStoredSettingValuesQuery: vi.fn(),
}));

vi.mock("~/settings/queries", () => ({
  useSetSettingValues: () => mocks.setSettingValues,
  useStoredSettingValuesQuery: mocks.useStoredSettingValuesQuery,
}));

import { SettingsProfile } from "./index";

describe("SettingsProfile", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("waits for stored settings before showing the form", () => {
    mocks.useStoredSettingValuesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<SettingsProfile />);

    expect(screen.getByLabelText("Loading settings")).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("saves profile fields as they change", async () => {
    mocks.useStoredSettingValuesQuery.mockReturnValue({
      data: {
        values: {
          user_profile_name: "Kevin",
          user_profile_role: "",
          user_profile_department: "",
          user_profile_context: "",
        },
        hasValues: new Set(["user_profile_name"]),
      },
      isLoading: false,
      error: null,
    });

    render(<SettingsProfile />);

    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Product" },
    });

    await waitFor(() => {
      expect(mocks.setSettingValues).toHaveBeenCalledWith({
        user_profile_name: "Kevin",
        user_profile_role: "Product",
        user_profile_department: "",
        user_profile_context: "",
      });
    });
  });
});
