import { beforeEach, describe, expect, test, vi } from "vitest";

const calendarCommands = vi.hoisted(() => ({
  listEvents: vi.fn(),
}));

const googleStorage = vi.hoisted(() => ({
  listGoogleCalendarConnectionIds: vi.fn(async () => [] as string[]),
  getFreshGoogleCalendarAccessToken: vi.fn(),
}));

vi.mock("@anlg/plugin-calendar", () => ({
  commands: calendarCommands,
}));

vi.mock("~/calendar/google-oauth/storage", () => googleStorage);

import type { Ctx } from "../ctx";
import { fetchIncomingEvents } from "./incoming";

const ctx: Ctx = {
  provider: "google",
  connectionId: "conn-1",
  from: new Date("2026-06-01T00:00:00.000Z"),
  to: new Date("2026-06-02T00:00:00.000Z"),
  calendarIds: new Set(["cal-1"]),
  calendarTrackingIdToId: new Map([["primary", "cal-1"]]),
};

describe("fetchIncomingEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    googleStorage.listGoogleCalendarConnectionIds.mockResolvedValue([]);
  });

  test("records an empty participant list so stale auto mappings are removed", async () => {
    calendarCommands.listEvents.mockResolvedValue({
      status: "success",
      data: [
        {
          id: "event-1",
          calendar_id: "primary",
          title: "No attendees",
          started_at: "2026-06-01T10:00:00.000Z",
          ended_at: "2026-06-01T11:00:00.000Z",
          attendees: [],
          organizer: null,
          has_recurrence_rules: false,
          is_all_day: false,
        },
      ],
    });

    const result = await fetchIncomingEvents(ctx);

    expect(result.events).toHaveLength(1);
    expect(result.participants.has("event-1")).toBe(true);
    expect(result.participants.get("event-1")).toEqual([]);
  });

  test("passes through the meeting link resolved during provider conversion", async () => {
    const meetingLink = "https://meet.google.com/abc-defg-hij";
    calendarCommands.listEvents.mockResolvedValue({
      status: "success",
      data: [
        {
          id: "event-1",
          calendar_id: "primary",
          title: "Customer call",
          description: "https://cal.com/customer-call/reschedule",
          location: "Conference room 4",
          meeting_link: meetingLink,
          started_at: "2026-06-01T10:00:00.000Z",
          ended_at: "2026-06-01T11:00:00.000Z",
          attendees: [],
          organizer: null,
          has_recurrence_rules: false,
          is_all_day: false,
        },
      ],
    });

    const result = await fetchIncomingEvents(ctx);

    expect(result.events[0]?.meeting_link).toBe(meetingLink);
  });

  test("keeps events from a healthy calendar when another calendar 404s", async () => {
    const mixedCtx: Ctx = {
      ...ctx,
      calendarIds: new Set(["cal-1", "cal-2"]),
      calendarTrackingIdToId: new Map([
        ["primary", "cal-1"],
        ["holiday", "cal-2"],
      ]),
    };
    calendarCommands.listEvents.mockImplementation(
      async (
        _provider: string,
        _connectionId: string,
        filter: { calendar_tracking_id: string },
      ) => {
        if (filter.calendar_tracking_id === "holiday") {
          return {
            status: "error",
            error: "Google Calendar API 404 Not Found",
          };
        }
        return {
          status: "success",
          data: [
            {
              id: "event-1",
              calendar_id: "primary",
              title: "Standup",
              started_at: "2026-06-01T10:00:00.000Z",
              ended_at: "2026-06-01T11:00:00.000Z",
              attendees: [],
              organizer: null,
              has_recurrence_rules: false,
              is_all_day: false,
            },
          ],
        };
      },
    );

    const result = await fetchIncomingEvents(mixedCtx);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.tracking_id_event).toBe("event-1");
    expect(result.failedTrackingIds).toEqual(["holiday"]);
  });

  test("aborts the connection when calendar auth fails", async () => {
    calendarCommands.listEvents.mockResolvedValue({
      status: "error",
      error: "Google Calendar API 401 Unauthorized",
    });

    await expect(fetchIncomingEvents(ctx)).rejects.toThrow(
      /Failed to fetch events for calendar primary/,
    );
  });

  test("aborts when every enabled calendar fails to fetch", async () => {
    calendarCommands.listEvents.mockResolvedValue({
      status: "error",
      error: "Google Calendar API 404 Not Found",
    });

    await expect(fetchIncomingEvents(ctx)).rejects.toThrow(
      /All enabled calendars failed to fetch/,
    );
  });
});
