import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openNew: vi.fn(),
  profile: {
    user_profile_name: "",
    user_profile_role: "",
    user_profile_department: "",
    user_profile_context: "",
  },
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (selector: (state: { openNew: typeof mocks.openNew }) => unknown) =>
    selector({ openNew: mocks.openNew }),
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: () => mocks.profile,
}));

import { SidebarUserFooter } from "./settings-link";

describe("SidebarUserFooter", () => {
  beforeEach(() => {
    mocks.openNew.mockClear();
    mocks.profile.user_profile_name = "";
    mocks.profile.user_profile_role = "";
    mocks.profile.user_profile_department = "";
    mocks.profile.user_profile_context = "";
  });

  afterEach(() => {
    cleanup();
  });

  it("opens Settings from the notes sidebar", () => {
    render(<SidebarUserFooter />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(mocks.openNew).toHaveBeenCalledWith({ type: "settings" });
  });

  it("opens Profile from the sidebar footer", () => {
    render(<SidebarUserFooter />);

    fireEvent.click(screen.getByRole("button", { name: /Add your profile/ }));

    expect(mocks.openNew).toHaveBeenCalledWith({
      type: "settings",
      state: { tab: "profile" },
    });
  });

  it("shows the saved name and role", () => {
    mocks.profile.user_profile_name = "Kevin Payoyo";
    mocks.profile.user_profile_role = "Product";
    mocks.profile.user_profile_department = "Engineering";

    render(<SidebarUserFooter />);

    expect(screen.getByText("Kevin Payoyo")).toBeTruthy();
    expect(screen.getByText("Product · Engineering")).toBeTruthy();
    expect(screen.getByText("KP")).toBeTruthy();
  });
});
