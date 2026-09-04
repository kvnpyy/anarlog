import { useMemo } from "react";

import {
  folderDisplayName,
  folderMatchesPath,
  normalizeFolderPath,
} from "../folders";
import {
  sessionSeriesId,
  suggestSmartFolders,
  type SmartFolderParticipant,
  type SmartFolderSession,
  type SmartFolderSuggestion,
} from "../smart-folders";

import { executeTransaction, liveQueryClient, useLiveQuery } from "~/db";
import { enqueueDatabaseWrite } from "~/db/write-queue";

type FolderSummarySqlRow = {
  folder_path: string;
  meeting_count: number;
};

type FolderSessionIdSqlRow = {
  id: string;
  folder_path: string;
};

type SeriesFolderSqlRow = {
  folder_path: string;
};

type SeriesIdentitySqlRow = {
  series_id: string;
  event_json: string;
};

type SmartFolderSessionSqlRow = {
  id: string;
  title: string;
  folder_path: string;
  series_id: string;
  created_at: string;
  owner_user_id: string;
  event_json: string;
};

type SmartFolderParticipantSqlRow = {
  session_id: string;
  human_id: string;
  source: string;
  name: string;
  email: string;
  organization_name: string;
};

export type FolderSummary = {
  path: string;
  count: number;
};

const EMPTY_FOLDER_SUMMARIES: FolderSummary[] = [];
const EMPTY_SESSIONS: SmartFolderSession[] = [];
const EMPTY_PARTICIPANTS: SmartFolderParticipant[] = [];

export function useFolderSummaries(): FolderSummary[] {
  const { data = EMPTY_FOLDER_SUMMARIES } = useLiveQuery<
    FolderSummarySqlRow,
    FolderSummary[]
  >({
    sql: `
      SELECT folder_path, COUNT(*) AS meeting_count
      FROM sessions
      WHERE deleted_at IS NULL
        AND folder_path != ''
      GROUP BY folder_path
      ORDER BY folder_path
    `,
    mapRows: mergeFolderSummaries,
  });
  return data;
}

export function useSmartFolderSuggestions(
  enabled = true,
): SmartFolderSuggestion[] {
  const { data: sessions = EMPTY_SESSIONS } = useLiveQuery<
    SmartFolderSessionSqlRow,
    SmartFolderSession[]
  >({
    sql: `
      SELECT
        id,
        title,
        folder_path,
        COALESCE(series_id, '') AS series_id,
        created_at,
        COALESCE(owner_user_id, '') AS owner_user_id,
        COALESCE(event_json, '') AS event_json
      FROM sessions
      WHERE deleted_at IS NULL
        AND folder_path = ''
    `,
    enabled,
    mapRows: (rows) => rows.map(mapSmartFolderSessionRow),
  });
  const { data: participants = EMPTY_PARTICIPANTS } = useLiveQuery<
    SmartFolderParticipantSqlRow,
    SmartFolderParticipant[]
  >({
    sql: `
      SELECT
        participant.session_id,
        participant.human_id,
        participant.source,
        COALESCE(NULLIF(human.name, ''), participant.display_name) AS name,
        COALESCE(NULLIF(human.email, ''), participant.email) AS email,
        COALESCE(organization.name, '') AS organization_name
      FROM session_participants AS participant
      INNER JOIN sessions
        ON sessions.id = participant.session_id
        AND sessions.deleted_at IS NULL
        AND sessions.folder_path = ''
      LEFT JOIN humans AS human
        ON human.id = participant.human_id AND human.deleted_at IS NULL
      LEFT JOIN organizations AS organization
        ON organization.id = human.organization_id
        AND organization.deleted_at IS NULL
      WHERE participant.deleted_at IS NULL
    `,
    enabled,
    mapRows: (rows) => rows.map(mapSmartFolderParticipantRow),
  });

  return useMemo(
    () => (enabled ? suggestSmartFolders(sessions, participants) : []),
    [enabled, participants, sessions],
  );
}

export async function listSessionIdsInFolder(
  folderPath: string,
): Promise<string[]> {
  const selected = folderDisplayName(folderPath);
  if (!selected) {
    return [];
  }

  const rows = await liveQueryClient.execute<FolderSessionIdSqlRow>(
    `
      SELECT id, folder_path
      FROM sessions
      WHERE deleted_at IS NULL
        AND folder_path != ''
    `,
    [],
  );
  return rows
    .filter((row) => folderMatchesPath(row.folder_path, selected))
    .map((row) => row.id);
}

export async function findFolderPathForSeries(
  seriesId: string,
): Promise<string> {
  const trimmed = seriesId.trim();
  if (!trimmed) {
    return "";
  }

  const rows = await liveQueryClient.execute<SeriesFolderSqlRow>(
    `
      SELECT folder_path
      FROM sessions
      WHERE deleted_at IS NULL
        AND folder_path != ''
        AND (
          (series_id != '' AND series_id = ?)
          OR json_extract(event_json, '$.recurrence_series_id') = ?
        )
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [trimmed, trimmed],
  );
  return folderDisplayName(rows[0]?.folder_path) || "";
}

export async function assignSessionsToFolder(
  sessionIds: readonly string[],
  folderPath: string,
): Promise<number> {
  const normalized = normalizeFolderPath(folderPath);
  if (normalized === null) {
    return 0;
  }

  const ids = [...new Set(sessionIds.filter(Boolean))];
  if (ids.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const rowsAffected = await enqueueDatabaseWrite("folders:assign", () =>
    executeTransaction([
      {
        sql: `
          UPDATE sessions
          SET folder_path = ?, updated_at = ?
          WHERE deleted_at IS NULL
            AND id IN (${ids.map(() => "?").join(", ")})
        `,
        params: [normalized, now, ...ids],
      },
    ]),
  );

  return Number(rowsAffected[0] ?? 0);
}

export async function fileUnfiledSeriesSiblings(
  sessionId: string,
  folderPath: string,
): Promise<number> {
  const normalized = normalizeFolderPath(folderPath);
  if (!sessionId || normalized === null || !normalized) {
    return 0;
  }

  const rows = await liveQueryClient.execute<SeriesIdentitySqlRow>(
    `
      SELECT
        COALESCE(series_id, '') AS series_id,
        COALESCE(event_json, '') AS event_json
      FROM sessions
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `,
    [sessionId],
  );
  const seriesId = sessionSeriesId({
    seriesId: rows[0]?.series_id,
    eventJson: rows[0]?.event_json,
  });
  if (!seriesId) {
    return 0;
  }

  const now = new Date().toISOString();
  const rowsAffected = await enqueueDatabaseWrite("folders:assign", () =>
    executeTransaction([
      {
        sql: `
          UPDATE sessions
          SET folder_path = ?, updated_at = ?
          WHERE deleted_at IS NULL
            AND folder_path = ''
            AND id != ?
            AND (
              (series_id != '' AND series_id = ?)
              OR json_extract(event_json, '$.recurrence_series_id') = ?
            )
        `,
        params: [normalized, now, sessionId, seriesId, seriesId],
      },
    ]),
  );

  return Number(rowsAffected[0] ?? 0);
}

function mergeFolderSummaries(rows: FolderSummarySqlRow[]): FolderSummary[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const path = folderDisplayName(row.folder_path);
    if (!path) {
      continue;
    }
    counts.set(path, (counts.get(path) ?? 0) + Number(row.meeting_count ?? 0));
  }

  return [...counts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function mapSmartFolderSessionRow(
  row: SmartFolderSessionSqlRow,
): SmartFolderSession {
  return {
    id: row.id,
    title: row.title,
    folderPath: row.folder_path,
    seriesId: row.series_id,
    createdAt: row.created_at,
    ownerUserId: row.owner_user_id,
    eventJson: row.event_json,
  };
}

function mapSmartFolderParticipantRow(
  row: SmartFolderParticipantSqlRow,
): SmartFolderParticipant {
  return {
    sessionId: row.session_id,
    humanId: row.human_id,
    source: row.source,
    name: row.name,
    email: row.email,
    organizationName: row.organization_name,
  };
}
