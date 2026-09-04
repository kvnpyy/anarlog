import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changelogByVersion: {
    "0.1.6": `---
date: "2026-09-04"
summary: "A calmer notepad."
---

Ask from the bottom of a note.
`,
  } as Record<string, string>,
  latestContent: `---
date: "2026-08-24"
summary: "Latest Anarlog notes."
---

Latest notes.
`,
  latestVersion: "1.4.13",
  fetch: vi.fn(),
}));

vi.mock("virtual:changelog", () => ({
  changelogByVersion: mocks.changelogByVersion,
  latestContent: mocks.latestContent,
  latestVersion: mocks.latestVersion,
}));

import {
  fallbackChangelogMarkdown,
  resolveChangelogRaw,
  useChangelogContent,
} from "./data";

describe("changelog data", () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("resolves the matching embedded version instead of only the latest file", () => {
    expect(resolveChangelogRaw("0.1.6")).toContain(
      "Ask from the bottom of a note.",
    );
    expect(resolveChangelogRaw("0.1.6")).not.toContain("Latest notes.");
  });

  it("falls back to friendly Acorn copy when a version has no notes", () => {
    const fallback = resolveChangelogRaw("0.1.99");

    expect(fallback).toBe(fallbackChangelogMarkdown());
    expect(fallback).toContain("Acorn just got a little smoother.");
    expect(fallback).toContain("small fixes");
  });

  it("renders embedded notes for the installed Acorn version", async () => {
    const { result } = renderHook(() => useChangelogContent("0.1.6"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toContain("Ask from the bottom of a note.");
    expect(result.current.date).toBe("2026-09-04");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("shows the friendly fallback when GitHub has no notes either", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => useChangelogContent("0.1.99"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.content).toContain(
      "Acorn just got a little smoother.",
    );
    expect(result.current.content).not.toBeNull();
  });
});
