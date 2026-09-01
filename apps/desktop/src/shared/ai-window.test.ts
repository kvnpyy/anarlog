import { describe, expect, it } from "vitest";

import {
  clampSearchCreatedAtFilter,
  getAiKnowledgeWindow,
  isWithinAiWindow,
  parseMeetingTimeMs,
  relativeDaysStartMs,
} from "./ai-window";

describe("AI knowledge window", () => {
  it("uses 30 days on Free and 365 days on Pro", () => {
    const now = new Date("2026-08-28T12:00:00");
    const free = getAiKnowledgeWindow(false, now);
    const pro = getAiKnowledgeWindow(true, now);

    expect(free).toMatchObject({ days: 30, isPro: false });
    expect(pro).toMatchObject({ days: 365, isPro: true });
    expect(free.cutoffMs).toBe(relativeDaysStartMs(30, now));
    expect(pro.cutoffMs).toBe(relativeDaysStartMs(365, now));
  });

  it("treats meetings older than the cutoff as outside the window", () => {
    const cutoff = Date.parse("2026-08-15T00:00:00.000Z");
    expect(
      isWithinAiWindow(Date.parse("2026-08-28T00:00:00.000Z"), cutoff),
    ).toBe(true);
    expect(
      isWithinAiWindow(Date.parse("2026-07-01T00:00:00.000Z"), cutoff),
    ).toBe(false);
    expect(isWithinAiWindow(null, cutoff)).toBe(true);
  });

  it("clamps search filters so they cannot look before the cutoff", () => {
    const cutoff = 1_000;
    expect(
      clampSearchCreatedAtFilter({ gte: 100, lte: 2_000 }, cutoff),
    ).toEqual({
      gte: cutoff,
      lte: 2_000,
    });
    expect(clampSearchCreatedAtFilter({ lte: 500 }, cutoff)).toBe("empty");
  });

  it("parses ISO timestamps and unix milliseconds", () => {
    expect(parseMeetingTimeMs("2026-08-28T00:00:00.000Z")).toBe(
      Date.parse("2026-08-28T00:00:00.000Z"),
    );
    expect(parseMeetingTimeMs(1_724_803_200_000)).toBe(1_724_803_200_000);
  });
});
