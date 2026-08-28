import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useHotkeys: vi.fn(),
}));

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: mocks.useHotkeys,
}));

import { useLeftSidebar } from "./leftsidebar";

describe("useLeftSidebar", () => {
  beforeEach(() => {
    mocks.useHotkeys.mockClear();
  });

  it("starts with the notes sidebar open", () => {
    const { result } = renderHook(() => useLeftSidebar());

    expect(result.current.expanded).toBe(true);
  });

  it("registers the sidebar toggle hotkey", () => {
    renderHook(() => useLeftSidebar());

    expect(mocks.useHotkeys).toHaveBeenCalledWith(
      "mod+\\",
      expect.any(Function),
      expect.objectContaining({
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
      }),
      expect.any(Array),
    );
  });
});
