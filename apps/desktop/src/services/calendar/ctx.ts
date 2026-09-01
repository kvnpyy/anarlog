import { commands as calendarCommands } from "@anlg/plugin-calendar";
import type {
  CalendarListItem,
  CalendarProviderType,
  ProviderConnectionIds,
} from "@anlg/plugin-calendar";

import { applyCalendarInventory, loadEnabledCalendars } from "./storage";

import {
  getFreshGoogleCalendarAccessToken,
  listGoogleCalendarConnectionIds,
} from "~/calendar/google-oauth/storage";
import { enqueueDatabaseWrite } from "~/db/write-queue";

export interface Ctx {
  provider: CalendarProviderType;
  connectionId: string;
  from: Date;
  to: Date;
  calendarIds: Set<string>;
  calendarTrackingIdToId: Map<string, string>;
}

export type CalendarSyncRange = {
  from: Date;
  to: Date;
};

export async function createCtx(
  provider: CalendarProviderType,
  connectionId: string,
  range: CalendarSyncRange = getDefaultRange(),
): Promise<Ctx> {
  const calendars = await loadEnabledCalendars(provider, connectionId);
  const calendarIds = new Set<string>();
  const calendarTrackingIdToId = new Map<string, string>();

  for (const calendar of calendars) {
    calendarIds.add(calendar.id);
    if (calendar.tracking_id_calendar) {
      calendarTrackingIdToId.set(calendar.tracking_id_calendar, calendar.id);
    }
  }

  return {
    provider,
    connectionId,
    from: range.from,
    to: range.to,
    calendarIds,
    calendarTrackingIdToId,
  };
}

export async function getProviderConnections(): Promise<
  ProviderConnectionIds[]
> {
  const localGoogleIds = await listGoogleCalendarConnectionIds();
  const result = await calendarCommands.listConnectionIds();
  if (result.status === "error") {
    if (localGoogleIds.length > 0) {
      return [{ provider: "google", connection_ids: localGoogleIds }];
    }
    throw new Error(`Failed to discover calendar connections: ${result.error}`);
  }
  return mergeGoogleConnectionIds(result.data, localGoogleIds);
}

function mergeGoogleConnectionIds(
  discovered: ProviderConnectionIds[],
  localGoogleIds: string[],
): ProviderConnectionIds[] {
  if (localGoogleIds.length === 0) {
    return discovered;
  }

  const merged = discovered.map((entry) =>
    entry.provider === "google"
      ? {
          ...entry,
          connection_ids: uniqueIds([
            ...entry.connection_ids,
            ...localGoogleIds,
          ]),
        }
      : entry,
  );
  if (!merged.some((entry) => entry.provider === "google")) {
    merged.push({ provider: "google", connection_ids: localGoogleIds });
  }
  return merged;
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

async function listCalendarsForConnection(
  provider: CalendarProviderType,
  connectionId: string,
) {
  if (provider === "google") {
    const localIds = await listGoogleCalendarConnectionIds();
    if (localIds.includes(connectionId)) {
      const accessToken = await getFreshGoogleCalendarAccessToken(connectionId);
      return calendarCommands.listGoogleCalendarsDirect(accessToken);
    }
  }

  return calendarCommands.listCalendars(provider, connectionId);
}

export async function syncCalendars(
  providerConnections: ProviderConnectionIds[],
  signal?: AbortSignal,
  shouldStop: () => boolean = () => signal?.aborted === true,
): Promise<void> {
  for (const { provider, connection_ids } of providerConnections) {
    if (shouldStop()) return;

    const successfulConnections: Array<{
      connectionId: string;
      calendars: CalendarListItem[];
    }> = [];

    for (const connectionId of connection_ids) {
      if (shouldStop()) return;

      const result = await listCalendarsForConnection(provider, connectionId);
      if (shouldStop()) return;
      if (result.status === "error") continue;
      successfulConnections.push({ connectionId, calendars: result.data });
    }

    if (shouldStop()) return;
    await enqueueDatabaseWrite("calendar-sync", async () => {
      if (shouldStop()) return;
      await applyCalendarInventory({
        provider,
        requestedConnectionIds: connection_ids,
        successfulConnections,
      });
    });
  }
}

export const getDefaultRange = (): CalendarSyncRange => {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 6);
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + 2);
  return { from, to };
};
