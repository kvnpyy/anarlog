import { describe, expect, it } from "vitest";

import { freeAiDailyLimitNotice, localDayKey, nextAiUsage } from "./ai-usage";

import { FREE_AI_DAILY_QUESTIONS } from "~/shared/product";

describe("free AI daily usage", () => {
  const now = new Date(2026, 8, 28, 18, 0, 0);

  it("counts questions inside the local day and resets the next day", () => {
    const first = nextAiUsage(undefined, now);

    expect(first.decision).toEqual({
      allowed: true,
      remaining: FREE_AI_DAILY_QUESTIONS - 1,
    });

    const full = nextAiUsage(
      JSON.stringify({ day: localDayKey(now), count: FREE_AI_DAILY_QUESTIONS }),
      now,
    );
    expect(full.decision.allowed).toBe(false);
    expect(JSON.parse(full.stored)).toEqual({
      day: localDayKey(now),
      count: FREE_AI_DAILY_QUESTIONS,
    });

    const tomorrow = nextAiUsage(full.stored, new Date(2026, 8, 29, 9, 0, 0));
    expect(tomorrow.decision.allowed).toBe(true);
  });

  it("tells a free user the daily cap and what Pro includes", () => {
    expect(freeAiDailyLimitNotice()).toContain(
      `${FREE_AI_DAILY_QUESTIONS} free AI questions`,
    );
    expect(freeAiDailyLimitNotice()).toContain("Acorn Pro");
  });
});
