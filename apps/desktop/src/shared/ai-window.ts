import type { SearchFilters } from "~/search/contexts/engine/types";
import {
  FREE_AI_WINDOW_DAYS,
  FREE_AI_WINDOW_NOTICE,
  PRO_AI_WINDOW_DAYS,
} from "~/shared/product";

export type AiKnowledgeWindow = {
  days: number;
  cutoffMs: number;
  isPro: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getAiKnowledgeWindow(
  isPro: boolean,
  now = new Date(),
): AiKnowledgeWindow {
  const days = isPro ? PRO_AI_WINDOW_DAYS : FREE_AI_WINDOW_DAYS;
  return {
    days,
    cutoffMs: relativeDaysStartMs(days, now),
    isPro,
  };
}

export function unboundedAiKnowledgeWindow(): AiKnowledgeWindow {
  return {
    days: PRO_AI_WINDOW_DAYS,
    cutoffMs: 0,
    isPro: true,
  };
}

export function relativeDaysFilter(
  days: number,
  now = new Date(),
): NonNullable<SearchFilters["created_at"]> {
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();

  return {
    gte: relativeDaysStartMs(days, now),
    lte: endOfToday,
  };
}

export function relativeDaysStartMs(days: number, now = new Date()): number {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return startOfToday - Math.max(days - 1, 0) * MS_PER_DAY;
}

export function parseMeetingTimeMs(
  ...values: Array<string | number | null | undefined>
): number | null {
  for (const value of values) {
    if (value == null || value === "") {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 1e12 ? value * 1000 : value;
    }
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function isWithinAiWindow(
  timestampMs: number | null,
  cutoffMs: number,
): boolean {
  if (timestampMs == null) {
    return true;
  }
  return timestampMs >= cutoffMs;
}

export function clampSearchCreatedAtFilter(
  filter: SearchFilters["created_at"] | undefined,
  cutoffMs: number,
): SearchFilters["created_at"] | "empty" {
  const next = { ...(filter ?? {}) };

  if (next.eq != null && next.eq < cutoffMs) {
    return "empty";
  }
  if (next.lte != null && next.lte < cutoffMs) {
    return "empty";
  }
  if (next.lt != null && next.lt <= cutoffMs) {
    return "empty";
  }

  const gte = next.gte == null ? cutoffMs : Math.max(next.gte, cutoffMs);
  let gt = next.gt;
  if (gt != null && gt < cutoffMs) {
    gt = undefined;
  }

  return {
    ...next,
    gte,
    gt,
  };
}

export function withAiWindowMeta<T extends object>(
  result: T,
  window: AiKnowledgeWindow,
): T & {
  ai_knowledge_window: { days: number; plan: "free" | "pro" };
  notice?: string;
} {
  return {
    ...result,
    ai_knowledge_window: {
      days: window.days,
      plan: window.isPro ? "pro" : "free",
    },
    ...(window.isPro ? {} : { notice: FREE_AI_WINDOW_NOTICE }),
  };
}

export function outsideAiWindowResult(
  meetingId: string,
  window: AiKnowledgeWindow,
) {
  return withAiWindowMeta(
    {
      error: "outside_ai_window" as const,
      meeting_id: meetingId,
      message: window.isPro
        ? `This meeting is older than the ${window.days}-day AI window.`
        : FREE_AI_WINDOW_NOTICE,
    },
    window,
  );
}
