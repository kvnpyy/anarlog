import { FREE_AI_DAILY_QUESTIONS } from "~/shared/product";

export function localDayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function freeAiDailyLimitNotice(): string {
  return `You've used today's ${FREE_AI_DAILY_QUESTIONS} free AI questions. They reset tomorrow. Acorn Pro includes unlimited questions and a smarter model on every question.`;
}

type UsageDecision = { allowed: true; remaining: number } | { allowed: false };

export function nextAiUsage(
  stored: string | undefined,
  now: Date,
  limit = FREE_AI_DAILY_QUESTIONS,
): { stored: string; decision: UsageDecision } {
  const today = localDayKey(now);
  const count = usageCountForDay(stored, today);
  if (count >= limit) {
    return {
      stored: JSON.stringify({ day: today, count }),
      decision: { allowed: false },
    };
  }

  const nextCount = count + 1;
  return {
    stored: JSON.stringify({ day: today, count: nextCount }),
    decision: { allowed: true, remaining: limit - nextCount },
  };
}

function usageCountForDay(stored: string | undefined, today: string): number {
  if (!stored) {
    return 0;
  }

  try {
    const value = JSON.parse(stored) as { day?: unknown; count?: unknown };
    if (value.day !== today || typeof value.count !== "number") {
      return 0;
    }
    return value.count;
  } catch {
    return 0;
  }
}
