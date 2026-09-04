import { folderDisplayName, normalizeFolderPath } from "./folders";
import { getSessionEvent } from "./utils";

const SPACE_REGEX = /\s+/g;
const GENERIC_TITLE_KEYS = new Set(["new note", "untitled"]);
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);
const MAX_FOLDER_NAME_LENGTH = 48;

export type SmartFolderReason =
  | "same_series"
  | "matching_title"
  | "shared_participants";

export type SmartFolderSession = {
  id: string;
  title: string;
  folderPath: string;
  seriesId: string;
  createdAt: string;
  ownerUserId: string;
  eventJson: string;
};

export type SmartFolderParticipant = {
  sessionId: string;
  humanId: string;
  source: string;
  name: string;
  email: string;
  organizationName: string;
};

export type SmartFolderSuggestion = {
  id: string;
  name: string;
  reason: SmartFolderReason;
  sessionIds: string[];
  titles: string[];
};

export function suggestSmartFolders(
  sessions: readonly SmartFolderSession[],
  participants: readonly SmartFolderParticipant[],
  userId: string | null = null,
): SmartFolderSuggestion[] {
  const unfiled = sessions.filter(
    (session) => !folderDisplayName(session.folderPath),
  );
  if (unfiled.length < 2) {
    return [];
  }

  const participantsBySession = groupParticipantsBySession(participants);
  const assigned = new Set<string>();
  const suggestions: SmartFolderSuggestion[] = [];

  for (const group of collectSeriesGroups(unfiled)) {
    if (group.length < 2) {
      continue;
    }
    suggestions.push(
      toSuggestion(group, participantsBySession, userId, "same_series"),
    );
    markAssigned(assigned, group);
  }

  const remainingAfterSeries = unfiled.filter(
    (session) => !assigned.has(session.id),
  );
  for (const group of collectTitleGroups(
    remainingAfterSeries,
    participantsBySession,
    userId,
  )) {
    suggestions.push(
      toSuggestion(group, participantsBySession, userId, "matching_title"),
    );
    markAssigned(assigned, group);
  }

  const remaining = unfiled.filter((session) => !assigned.has(session.id));
  for (const group of collectParticipantGroups(
    remaining,
    participantsBySession,
    userId,
  )) {
    suggestions.push(
      toSuggestion(group, participantsBySession, userId, "shared_participants"),
    );
  }

  return suggestions.sort((left, right) => {
    const reasonDelta =
      reasonRank(right.reason) - reasonRank(left.reason) ||
      right.sessionIds.length - left.sessionIds.length;
    if (reasonDelta !== 0) {
      return reasonDelta;
    }
    return left.name.localeCompare(right.name);
  });
}

export function sessionSeriesId(session: {
  seriesId?: string;
  eventJson?: string;
}): string {
  const column = session.seriesId?.trim();
  if (column) {
    return column;
  }

  return (
    getSessionEvent({
      event_json: session.eventJson,
    })?.recurrence_series_id?.trim() ?? ""
  );
}

export function sessionTitleKey(title: string | null | undefined): string {
  const key = (title?.trim() || "Untitled")
    .toLowerCase()
    .replace(SPACE_REGEX, " ");
  return GENERIC_TITLE_KEYS.has(key) ? "" : key;
}

function collectSeriesGroups(
  sessions: readonly SmartFolderSession[],
): SmartFolderSession[][] {
  const groups = new Map<string, SmartFolderSession[]>();
  for (const session of sessions) {
    const seriesId = sessionSeriesId(session);
    if (!seriesId) {
      continue;
    }
    const group = groups.get(seriesId);
    if (group) {
      group.push(session);
    } else {
      groups.set(seriesId, [session]);
    }
  }
  return [...groups.values()];
}

function collectTitleGroups(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
): SmartFolderSession[][] {
  const groups = new Map<string, SmartFolderSession[]>();
  for (const session of sessions) {
    const titleKey = sessionTitleKey(session.title);
    if (!titleKey) {
      continue;
    }
    const group = groups.get(titleKey);
    if (group) {
      group.push(session);
    } else {
      groups.set(titleKey, [session]);
    }
  }

  return [...groups.values()].flatMap((group) => {
    if (group.length < 2) {
      return [];
    }

    return clusterBySharedParticipants(group, participantsBySession, userId, 1);
  });
}

function collectParticipantGroups(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
): SmartFolderSession[][] {
  const identical = new Map<string, SmartFolderSession[]>();
  for (const session of sessions) {
    const ids = [
      ...externalParticipantIds(
        participantsBySession.get(session.id) ?? [],
        session.ownerUserId || userId,
      ),
    ].sort();
    if (ids.length === 0) {
      continue;
    }
    const key = ids.join("\0");
    const group = identical.get(key);
    if (group) {
      group.push(session);
    } else {
      identical.set(key, [session]);
    }
  }

  const assigned = new Set<string>();
  const groups: SmartFolderSession[][] = [];
  for (const group of identical.values()) {
    if (group.length < 2) {
      continue;
    }
    groups.push(group);
    markAssigned(assigned, group);
  }

  const leftover = sessions.filter((session) => !assigned.has(session.id));
  for (const group of clusterBySharedParticipants(
    leftover,
    participantsBySession,
    userId,
    2,
  )) {
    groups.push(group);
  }

  return groups;
}

function clusterBySharedParticipants(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
  minShared: number,
): SmartFolderSession[][] {
  const ids = sessions.map((session) =>
    externalParticipantIds(
      participantsBySession.get(session.id) ?? [],
      session.ownerUserId || userId,
    ),
  );
  const parent = sessions.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current] ?? current] ?? current;
      current = parent[current] ?? current;
    }
    return current;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  };

  for (let left = 0; left < sessions.length; left += 1) {
    for (let right = left + 1; right < sessions.length; right += 1) {
      if (
        intersectionSize(ids[left] ?? new Set(), ids[right] ?? new Set()) >=
        minShared
      ) {
        union(left, right);
      }
    }
  }

  const clusters = new Map<number, SmartFolderSession[]>();
  sessions.forEach((session, index) => {
    const root = find(index);
    const group = clusters.get(root);
    if (group) {
      group.push(session);
    } else {
      clusters.set(root, [session]);
    }
  });

  return [...clusters.values()].filter((group) => group.length >= 2);
}

function toSuggestion(
  group: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
  reason: SmartFolderReason,
): SmartFolderSuggestion {
  const ordered = [...group].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const sessionIds = ordered.map((session) => session.id);
  return {
    id: `${reason}:${sessionIds.slice().sort().join(",")}`,
    name: suggestFolderName(ordered, participantsBySession, userId, reason),
    reason,
    sessionIds,
    titles: uniqueTitles(ordered),
  };
}

function suggestFolderName(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
  reason: SmartFolderReason,
): string {
  if (reason === "same_series" || reason === "matching_title") {
    const titled = sessions.find((session) => sessionTitleKey(session.title));
    if (titled) {
      return clipFolderName(titled.title.trim());
    }
  }

  const orgName = majorityOrganization(sessions, participantsBySession, userId);
  if (orgName) {
    return clipFolderName(orgName);
  }

  const domain = majorityEmailDomain(sessions, participantsBySession, userId);
  if (domain) {
    return clipFolderName(domainLabel(domain));
  }

  const names = sharedParticipantNames(sessions, participantsBySession, userId);
  if (names.length === 1) {
    return clipFolderName(`Meetings with ${names[0]}`);
  }
  if (names.length === 2) {
    return clipFolderName(`${names[0]} and ${names[1]}`);
  }
  if (names.length > 2) {
    return clipFolderName(`${names[0]}, ${names[1]}`);
  }

  const fallback = sessions.find((session) => sessionTitleKey(session.title));
  return clipFolderName(fallback?.title.trim() || "Meetings");
}

function majorityOrganization(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
): string | null {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const names = new Set<string>();
    for (const participant of participantsFor(
      session,
      participantsBySession,
      userId,
    )) {
      const name = participant.organizationName.trim();
      if (name) {
        names.add(name);
      }
    }
    for (const name of names) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return majorityLabel(counts, sessions.length);
}

function majorityEmailDomain(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
): string | null {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const domains = new Set<string>();
    for (const participant of participantsFor(
      session,
      participantsBySession,
      userId,
    )) {
      const domain = emailDomain(participant.email);
      if (domain && !GENERIC_EMAIL_DOMAINS.has(domain)) {
        domains.add(domain);
      }
    }
    for (const domain of domains) {
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
  }
  return majorityLabel(counts, sessions.length);
}

function sharedParticipantNames(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
): string[] {
  let shared: Set<string> | null = null;
  const namesById = new Map<string, string>();
  for (const session of sessions) {
    const ids = externalParticipantIds(
      participantsBySession.get(session.id) ?? [],
      session.ownerUserId || userId,
    );
    for (const participant of participantsBySession.get(session.id) ?? []) {
      if (ids.has(participant.humanId) && participant.name.trim()) {
        namesById.set(participant.humanId, participant.name.trim());
      }
    }
    shared = shared ? intersect(shared, ids) : new Set(ids);
  }

  return [...(shared ?? [])]
    .map((id) => namesById.get(id) || id)
    .sort((left, right) => left.localeCompare(right));
}

function participantsFor(
  session: SmartFolderSession,
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
): SmartFolderParticipant[] {
  const ownerId = session.ownerUserId || userId;
  return (participantsBySession.get(session.id) ?? []).filter((participant) => {
    if (participant.source === "excluded" || !participant.humanId) {
      return false;
    }
    return !ownerId || participant.humanId !== ownerId;
  });
}

function externalParticipantIds(
  participants: readonly SmartFolderParticipant[],
  userId: string | null,
): Set<string> {
  const ids = new Set<string>();
  for (const participant of participants) {
    if (participant.source === "excluded" || !participant.humanId) {
      continue;
    }
    if (userId && participant.humanId === userId) {
      continue;
    }
    ids.add(participant.humanId);
  }
  return ids;
}

function groupParticipantsBySession(
  participants: readonly SmartFolderParticipant[],
): Map<string, SmartFolderParticipant[]> {
  const grouped = new Map<string, SmartFolderParticipant[]>();
  for (const participant of participants) {
    const group = grouped.get(participant.sessionId);
    if (group) {
      group.push(participant);
    } else {
      grouped.set(participant.sessionId, [participant]);
    }
  }
  return grouped;
}

function uniqueTitles(sessions: readonly SmartFolderSession[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const session of sessions) {
    const title = session.title.trim() || "Untitled";
    const key = title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    titles.push(title);
  }
  return titles;
}

function clipFolderName(value: string): string {
  const trimmed = value
    .replace(SPACE_REGEX, " ")
    .trim()
    .slice(0, MAX_FOLDER_NAME_LENGTH);
  const normalized = normalizeFolderPath(trimmed.replace(/\//g, " "));
  return normalized || "Meetings";
}

function domainLabel(domain: string): string {
  const head = domain.split(".")[0] ?? domain;
  if (!head) {
    return domain;
  }
  return head.charAt(0).toUpperCase() + head.slice(1);
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    return null;
  }
  return (
    email
      .slice(at + 1)
      .trim()
      .toLowerCase() || null
  );
}

function majorityLabel(
  counts: Map<string, number>,
  sessionCount: number,
): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  if (!best || bestCount < Math.ceil(sessionCount / 2)) {
    return null;
  }
  return best;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

function intersect(left: Set<string>, right: Set<string>): Set<string> {
  const next = new Set<string>();
  for (const value of left) {
    if (right.has(value)) {
      next.add(value);
    }
  }
  return next;
}

function markAssigned(
  assigned: Set<string>,
  group: readonly SmartFolderSession[],
) {
  for (const session of group) {
    assigned.add(session.id);
  }
}

function reasonRank(reason: SmartFolderReason): number {
  switch (reason) {
    case "same_series":
      return 2;
    case "matching_title":
      return 1;
    case "shared_participants":
      return 0;
  }
}
