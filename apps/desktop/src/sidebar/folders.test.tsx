import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  folders: [] as Array<{ path: string; count: number }>,
  activeFolderPath: null as string | null,
  setActiveFolderPath: vi.fn(),
  toggleActiveFolderPath: vi.fn(),
}));

vi.mock("./organize-folders-dialog", () => ({
  OrganizeFoldersDialog: () => null,
}));

vi.mock("~/session/queries", () => ({
  useFolderSummaries: () => mocks.folders,
  useSmartFolderSuggestions: () => [],
  assignSessionsToFolder: vi.fn(),
}));

vi.mock("~/store/zustand/folder-filter", () => ({
  useFolderFilter: (
    selector: (state: {
      activeFolderPath: string | null;
      setActiveFolderPath: typeof mocks.setActiveFolderPath;
      toggleActiveFolderPath: typeof mocks.toggleActiveFolderPath;
    }) => unknown,
  ) =>
    selector({
      activeFolderPath: mocks.activeFolderPath,
      setActiveFolderPath: mocks.setActiveFolderPath,
      toggleActiveFolderPath: mocks.toggleActiveFolderPath,
    }),
}));

import { SidebarFolders } from "./folders";

describe("SidebarFolders", () => {
  beforeEach(() => {
    mocks.folders = [
      { path: "Standups", count: 4 },
      { path: "Acme", count: 2 },
    ];
    mocks.activeFolderPath = null;
    mocks.setActiveFolderPath.mockClear();
    mocks.toggleActiveFolderPath.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists folders with counts and lets the user select one", () => {
    render(<SidebarFolders />);

    fireEvent.click(screen.getByRole("button", { name: /Standups/ }));

    expect(mocks.toggleActiveFolderPath).toHaveBeenCalledWith("Standups");
    expect(screen.getByText("4")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Organize meetings into folders" }),
    ).toBeTruthy();
  });

  it("clears the folder filter from All notes", () => {
    mocks.activeFolderPath = "Standups";

    render(<SidebarFolders />);

    fireEvent.click(screen.getByRole("button", { name: "All notes" }));

    expect(mocks.setActiveFolderPath).toHaveBeenCalledWith(null);
  });
});
