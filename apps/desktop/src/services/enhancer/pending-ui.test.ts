import { afterEach, describe, expect, it } from "vitest";

import {
  clearAutoEnhancePending,
  getAutoEnhancePendingNoteId,
  isAutoEnhancePending,
  resetAutoEnhancePendingForTests,
  setAutoEnhancePending,
} from "./pending-ui";

describe("auto-enhance pending UI", () => {
  afterEach(() => {
    resetAutoEnhancePendingForTests();
  });

  it("stores a pending note id until it is cleared", () => {
    setAutoEnhancePending("session-1", "note-1");

    expect(isAutoEnhancePending("session-1")).toBe(true);
    expect(getAutoEnhancePendingNoteId("session-1")).toBe("note-1");

    clearAutoEnhancePending("session-1");

    expect(isAutoEnhancePending("session-1")).toBe(false);
    expect(getAutoEnhancePendingNoteId("session-1")).toBeNull();
  });
});
