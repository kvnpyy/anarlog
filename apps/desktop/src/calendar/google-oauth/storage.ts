import type { ConnectionItem } from "@anlg/api-client";
import { commands as store2Commands } from "@anlg/plugin-store2";

import {
  type GoogleCalendarCredential,
  isGoogleCalendarCredentialFresh,
  refreshGoogleCalendarCredential,
} from "./oauth";

export const GOOGLE_CALENDAR_INTEGRATION_ID = "google-calendar";
export const GOOGLE_CALENDAR_CONNECTIONS_QUERY_KEY = [
  "google-calendar-connections",
] as const;

const METADATA_SCOPE = "google-calendar";
const METADATA_KEY = "connections";
const SECRET_SCOPE = "google-calendar-oauth";

export type GoogleCalendarConnection = {
  connection_id: string;
  email: string;
  status: "ok" | "reconnect_required";
};

function unwrap<T>(
  result: { status: "ok"; data: T } | { status: "error"; error: string },
): T {
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}

function parseConnections(value: string | null): GoogleCalendarConnection[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as GoogleCalendarConnection).connection_id !== "string" ||
        typeof (item as GoogleCalendarConnection).email !== "string"
      ) {
        return [];
      }

      const connection = item as GoogleCalendarConnection;
      return [
        {
          connection_id: connection.connection_id,
          email: connection.email,
          status:
            connection.status === "reconnect_required"
              ? "reconnect_required"
              : "ok",
        },
      ];
    });
  } catch {
    return [];
  }
}

function parseCredential(
  value: string | null,
): GoogleCalendarCredential | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<GoogleCalendarCredential>;
    if (
      parsed.type !== "oauth" ||
      typeof parsed.refresh !== "string" ||
      parsed.refresh.length === 0 ||
      typeof parsed.access !== "string" ||
      typeof parsed.expires !== "number"
    ) {
      return null;
    }

    return {
      type: "oauth",
      refresh: parsed.refresh,
      access: parsed.access,
      expires: parsed.expires,
    };
  } catch {
    return null;
  }
}

export async function listGoogleCalendarConnections(): Promise<
  GoogleCalendarConnection[]
> {
  const value = unwrap(
    await store2Commands.getStr(METADATA_SCOPE, METADATA_KEY),
  );
  return parseConnections(value);
}

export async function listGoogleCalendarConnectionIds(): Promise<string[]> {
  return (await listGoogleCalendarConnections()).map(
    (connection) => connection.connection_id,
  );
}

export function toConnectionItem(
  connection: GoogleCalendarConnection,
): ConnectionItem {
  return {
    connection_id: connection.connection_id,
    integration_id: GOOGLE_CALENDAR_INTEGRATION_ID,
    account_identity: connection.email,
    status: connection.status,
  };
}

export async function saveGoogleCalendarConnection(input: {
  connectionId?: string;
  email: string;
  credential: GoogleCalendarCredential;
}): Promise<GoogleCalendarConnection> {
  const connections = await listGoogleCalendarConnections();
  const existing =
    (input.connectionId
      ? connections.find(
          (connection) => connection.connection_id === input.connectionId,
        )
      : undefined) ??
    connections.find(
      (connection) =>
        connection.email.toLowerCase() === input.email.toLowerCase(),
    );
  const connectionId = existing?.connection_id ?? crypto.randomUUID();
  const next: GoogleCalendarConnection = {
    connection_id: connectionId,
    email: input.email,
    status: "ok",
  };
  const updated = [
    next,
    ...connections.filter(
      (connection) => connection.connection_id !== connectionId,
    ),
  ];

  unwrap(
    await store2Commands.setSecret(
      SECRET_SCOPE,
      connectionId,
      JSON.stringify(input.credential),
    ),
  );
  unwrap(
    await store2Commands.setStr(
      METADATA_SCOPE,
      METADATA_KEY,
      JSON.stringify(updated),
    ),
  );
  return next;
}

export async function markGoogleCalendarReconnectRequired(
  connectionId: string,
): Promise<void> {
  const connections = await listGoogleCalendarConnections();
  const updated = connections.map((connection) =>
    connection.connection_id === connectionId
      ? { ...connection, status: "reconnect_required" as const }
      : connection,
  );
  unwrap(
    await store2Commands.setStr(
      METADATA_SCOPE,
      METADATA_KEY,
      JSON.stringify(updated),
    ),
  );
}

export async function deleteGoogleCalendarConnection(
  connectionId: string,
): Promise<void> {
  const connections = await listGoogleCalendarConnections();
  unwrap(await store2Commands.deleteSecret(SECRET_SCOPE, connectionId));
  unwrap(
    await store2Commands.setStr(
      METADATA_SCOPE,
      METADATA_KEY,
      JSON.stringify(
        connections.filter(
          (connection) => connection.connection_id !== connectionId,
        ),
      ),
    ),
  );
}

export async function getFreshGoogleCalendarAccessToken(
  connectionId: string,
): Promise<string> {
  const stored = unwrap(
    await store2Commands.getSecret(SECRET_SCOPE, connectionId),
  );
  const credential = parseCredential(stored);
  if (!credential) {
    await markGoogleCalendarReconnectRequired(connectionId);
    throw new Error("Google Calendar needs to be reconnected.");
  }

  if (isGoogleCalendarCredentialFresh(credential)) {
    return credential.access;
  }

  try {
    const refreshed = await refreshGoogleCalendarCredential(credential);
    unwrap(
      await store2Commands.setSecret(
        SECRET_SCOPE,
        connectionId,
        JSON.stringify(refreshed),
      ),
    );
    return refreshed.access;
  } catch (error) {
    await markGoogleCalendarReconnectRequired(connectionId);
    throw error;
  }
}
