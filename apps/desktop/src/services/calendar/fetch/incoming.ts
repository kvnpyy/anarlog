import { commands as calendarCommands } from "@anlg/plugin-calendar";
import type { CalendarEvent } from "@anlg/plugin-calendar";

import type { Ctx } from "../ctx";
import type {
  EventParticipant,
  IncomingEvent,
  IncomingParticipants,
} from "./types";

import {
  getFreshGoogleCalendarAccessToken,
  listGoogleCalendarConnectionIds,
} from "~/calendar/google-oauth/storage";

export class CalendarFetchError extends Error {
  constructor(
    public readonly calendarTrackingId: string,
    public readonly cause: string,
  ) {
    super(
      `Failed to fetch events for calendar ${calendarTrackingId}: ${cause}`,
    );
    this.name = "CalendarFetchError";
  }
}

export function isFatalCalendarFetchError(cause: string) {
  return /401|403|unauthorized|unauthenticated|invalid_grant|invalid.?token|token.?expired/i.test(
    cause,
  );
}

async function listEventsForConnection(ctx: Ctx, trackingId: string) {
  const filter = {
    calendar_tracking_id: trackingId,
    from: ctx.from.toISOString(),
    to: ctx.to.toISOString(),
  };

  if (ctx.provider === "google") {
    const localIds = await listGoogleCalendarConnectionIds();
    if (localIds.includes(ctx.connectionId)) {
      const accessToken = await getFreshGoogleCalendarAccessToken(
        ctx.connectionId,
      );
      return calendarCommands.listGoogleEventsDirect(accessToken, filter);
    }
  }

  return calendarCommands.listEvents(ctx.provider, ctx.connectionId, filter);
}

export async function fetchIncomingEvents(ctx: Ctx): Promise<{
  events: IncomingEvent[];
  participants: IncomingParticipants;
  failedTrackingIds: string[];
}> {
  const trackingIds = Array.from(ctx.calendarTrackingIdToId.keys());
  const failedTrackingIds: string[] = [];
  const calendarEvents: CalendarEvent[] = [];

  const results = await Promise.all(
    trackingIds.map(async (trackingId) => {
      try {
        const result = await listEventsForConnection(ctx, trackingId);
        return { trackingId, result };
      } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        return {
          trackingId,
          result: { status: "error" as const, error: cause },
        };
      }
    }),
  );

  for (const { trackingId, result } of results) {
    if (result.status === "error") {
      if (isFatalCalendarFetchError(result.error)) {
        throw new CalendarFetchError(trackingId, result.error);
      }
      console.warn(
        `[calendar-sync] Skipping calendar ${trackingId}: ${result.error}`,
      );
      failedTrackingIds.push(trackingId);
      continue;
    }

    calendarEvents.push(...result.data);
  }

  if (
    trackingIds.length > 0 &&
    failedTrackingIds.length === trackingIds.length
  ) {
    throw new CalendarFetchError(
      failedTrackingIds[0] ?? trackingIds[0] ?? "",
      "All enabled calendars failed to fetch",
    );
  }
  const events: IncomingEvent[] = [];
  const participants: IncomingParticipants = new Map();

  for (const calendarEvent of calendarEvents) {
    if (
      calendarEvent.attendees.find(
        (attendee) =>
          attendee.is_current_user && attendee.status === "declined",
      )
    ) {
      continue;
    }
    const { event, eventParticipants } = normalizeCalendarEvent(calendarEvent);
    events.push(event);
    participants.set(event.tracking_id_event, eventParticipants);
  }

  return { events, participants, failedTrackingIds };
}

// Meeting links are fully resolved on the Rust side during provider
// conversion, so no per-event parse IPC happens here.
function normalizeCalendarEvent(calendarEvent: CalendarEvent): {
  event: IncomingEvent;
  eventParticipants: EventParticipant[];
} {
  const eventParticipants: EventParticipant[] = [];

  if (calendarEvent.organizer) {
    eventParticipants.push({
      name: calendarEvent.organizer.name ?? undefined,
      email: calendarEvent.organizer.email ?? undefined,
      is_organizer: true,
      is_current_user: calendarEvent.organizer.is_current_user,
    });
  }

  const organizerEmail = calendarEvent.organizer?.email?.toLowerCase();

  for (const attendee of calendarEvent.attendees) {
    if (attendee.role === "nonparticipant") continue;
    if (organizerEmail && attendee.email?.toLowerCase() === organizerEmail)
      continue;
    eventParticipants.push({
      name: attendee.name ?? undefined,
      email: attendee.email ?? undefined,
      is_organizer: false,
      is_current_user: attendee.is_current_user,
    });
  }

  return {
    event: {
      tracking_id_event: calendarEvent.id,
      tracking_id_calendar: calendarEvent.calendar_id,
      title: calendarEvent.title,
      started_at: calendarEvent.started_at,
      ended_at: calendarEvent.ended_at,
      location: calendarEvent.location ?? undefined,
      meeting_link: calendarEvent.meeting_link ?? undefined,
      description: calendarEvent.description ?? undefined,
      recurrence_series_id: calendarEvent.recurring_event_id ?? undefined,
      has_recurrence_rules: calendarEvent.has_recurrence_rules,
      is_all_day: calendarEvent.is_all_day,
    },
    eventParticipants,
  };
}
