import { describe, expect, test } from "vitest";

import { shouldShowCalendarFirstFill } from "./calendar-view-state";

describe("shouldShowCalendarFirstFill", () => {
  test("shows while enabled calendars are syncing with no events yet", () => {
    expect(
      shouldShowCalendarFirstFill({
        enabledCalendarCount: 1,
        eventCount: 0,
        status: "syncing",
      }),
    ).toBe(true);
    expect(
      shouldShowCalendarFirstFill({
        enabledCalendarCount: 2,
        eventCount: 0,
        status: "scheduled",
      }),
    ).toBe(true);
  });

  test("hides after events arrive or when nothing is syncing", () => {
    expect(
      shouldShowCalendarFirstFill({
        enabledCalendarCount: 1,
        eventCount: 3,
        status: "syncing",
      }),
    ).toBe(false);
    expect(
      shouldShowCalendarFirstFill({
        enabledCalendarCount: 1,
        eventCount: 0,
        status: "idle",
      }),
    ).toBe(false);
    expect(
      shouldShowCalendarFirstFill({
        enabledCalendarCount: 0,
        eventCount: 0,
        status: "syncing",
      }),
    ).toBe(false);
  });
});
