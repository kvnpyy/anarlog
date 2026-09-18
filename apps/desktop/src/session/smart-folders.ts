import { folderDisplayName, normalizeFolderPath } from "./folders";
import { getSessionEvent } from "./utils";

import {
  companyTermFromEmail,
  isBusinessEmail,
  normalizeMailbox,
} from "~/contacts/company-from-email";

const SPACE_REGEX = /\s+/g;
const GENERIC_TITLE_KEYS = new Set([
  "new note",
  "untitled",
  "untitled note",
  "meeting",
  "meetings",
  "call",
  "chat",
  "sync",
  "weekly sync",
  "quick sync",
  "standup",
  "stand-up",
  "huddle",
  "check-in",
  "check in",
  "checkin",
  "catch up",
  "catch-up",
  "follow-up",
  "follow up",
  "followup",
  "intro",
  "introduction",
  "recap",
  "1:1",
  "1-1",
  "1 on 1",
  "one on one",
  "zoom",
  "google meet",
]);
const GENERIC_TITLE_TOKENS = new Set([
  "weekly",
  "biweekly",
  "monthly",
  "daily",
  "sync",
  "standup",
  "stand-up",
  "meeting",
  "meetings",
  "call",
  "chat",
  "check-in",
  "checkin",
  "intro",
  "introduction",
  "follow-up",
  "followup",
  "catch-up",
  "huddle",
  "recap",
  "with",
  "and",
  "the",
  "a",
  "an",
  "for",
  "on",
  "of",
  "1:1",
  "1-1",
  "zoom",
]);
const MAX_FOLDER_NAME_LENGTH = 48;

export type SmartFolderReason =
  | "same_series"
  | "matching_title"
  | "shared_participants";

export type SmartFolderAudience = "internal" | "external";

export type SmartFolderSession = {
  id: string;
  title: string;
  folderPath: string;
  seriesId: string;
  createdAt: string;
  ownerUserId: string;
  eventJson: string;
  discussed?: string;
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

type OwnerIdentity = {
  userId: string | null;
  domain: string | null;
  organizationName: string | null;
};

type SessionAudience = SmartFolderAudience;

export function suggestSmartFolders(
  sessions: readonly SmartFolderSession[],
  participants: readonly SmartFolderParticipant[],
  userId: string | null = null,
  ownerEmail: string | null = null,
): SmartFolderSuggestion[] {
  const unfiled = sessions.filter(
    (session) => !folderDisplayName(session.folderPath),
  );
  if (unfiled.length < 2) {
    return [];
  }

  const participantsBySession = groupParticipantsBySession(participants);
  const owner = resolveOwnerIdentity(
    unfiled,
    participantsBySession,
    userId,
    ownerEmail,
  );
  const assigned = new Set<string>();
  const suggestions: SmartFolderSuggestion[] = [];

  const pushGroup = (
    group: readonly SmartFolderSession[],
    reason: SmartFolderReason,
  ) => {
    if (group.length < 2) {
      return;
    }
    suggestions.push(toSuggestion(group, participantsBySession, owner, reason));
    markAssigned(assigned, group);
  };

  for (const group of collectSeriesGroups(unfiled)) {
    for (const audienceGroup of splitByAudience(
      group,
      participantsBySession,
      owner,
    )) {
      pushGroup(audienceGroup, "same_series");
    }
  }

  const remainingAfterSeries = unfiled.filter(
    (session) => !assigned.has(session.id),
  );
  for (const group of collectTitleGroups(
    remainingAfterSeries,
    participantsBySession,
    owner,
  )) {
    pushGroup(group, "matching_title");
  }

  const remaining = unfiled.filter((session) => !assigned.has(session.id));
  for (const group of collectCompanyGroups(
    remaining,
    participantsBySession,
    owner,
  )) {
    pushGroup(group, "shared_participants");
  }

  const leftover = unfiled.filter((session) => !assigned.has(session.id));
  for (const group of collectParticipantGroups(
    leftover,
    participantsBySession,
    owner,
  )) {
    pushGroup(group, "shared_participants");
  }

  return uniquifySuggestionNames(
    suggestions.sort((left, right) => {
      const reasonDelta =
        reasonRank(right.reason) - reasonRank(left.reason) ||
        right.sessionIds.length - left.sessionIds.length;
      if (reasonDelta !== 0) {
        return reasonDelta;
      }
      return left.name.localeCompare(right.name);
    }),
  );
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
  owner: OwnerIdentity,
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
    return splitByAudience(group, participantsBySession, owner).flatMap(
      (audienceGroup) => {
        if (audienceGroup.length < 2) {
          return [];
        }
        if (
          sessionAudience(audienceGroup[0]!, participantsBySession, owner) ===
          "external"
        ) {
          return clusterBySharedParticipants(
            audienceGroup,
            participantsBySession,
            owner,
            1,
            "external",
          );
        }
        return clusterBySharedParticipants(
          audienceGroup,
          participantsBySession,
          owner,
          1,
          "internal",
        );
      },
    );
  });
}

function collectCompanyGroups(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): SmartFolderSession[][] {
  const groups = new Map<string, SmartFolderSession[]>();
  for (const session of sessions) {
    if (sessionAudience(session, participantsBySession, owner) !== "external") {
      continue;
    }
    const company = sessionCompanyKey(session, participantsBySession, owner);
    if (!company) {
      continue;
    }
    const group = groups.get(company);
    if (group) {
      group.push(session);
    } else {
      groups.set(company, [session]);
    }
  }
  return [...groups.values()].filter((group) => group.length >= 2);
}

function collectParticipantGroups(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): SmartFolderSession[][] {
  const groups: SmartFolderSession[][] = [];
  for (const audience of ["external", "internal"] as const) {
    const scoped = sessions.filter(
      (session) =>
        sessionAudience(session, participantsBySession, owner) === audience,
    );
    const identical = new Map<string, SmartFolderSession[]>();
    for (const session of scoped) {
      const ids = [
        ...clusteringParticipantIds(
          participantsBySession.get(session.id) ?? [],
          owner,
          audience,
        ),
      ].sort();
      if (ids.length === 0) {
        continue;
      }
      const key = `${audience}:${ids.join("\0")}`;
      const group = identical.get(key);
      if (group) {
        group.push(session);
      } else {
        identical.set(key, [session]);
      }
    }

    const assigned = new Set<string>();
    for (const group of identical.values()) {
      if (group.length < 2) {
        continue;
      }
      groups.push(group);
      markAssigned(assigned, group);
    }

    const leftover = scoped.filter((session) => !assigned.has(session.id));
    for (const group of clusterBySharedParticipants(
      leftover,
      participantsBySession,
      owner,
      audience === "external" ? 1 : 2,
      audience,
    )) {
      groups.push(group);
    }
  }
  return groups;
}

function clusterBySharedParticipants(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
  minShared: number,
  audience: SessionAudience,
): SmartFolderSession[][] {
  const ids = sessions.map((session) =>
    clusteringParticipantIds(
      participantsBySession.get(session.id) ?? [],
      owner,
      audience,
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

function splitByAudience(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): SmartFolderSession[][] {
  const internal: SmartFolderSession[] = [];
  const external: SmartFolderSession[] = [];
  for (const session of sessions) {
    if (sessionAudience(session, participantsBySession, owner) === "external") {
      external.push(session);
    } else {
      internal.push(session);
    }
  }
  return [internal, external].filter((group) => group.length >= 2);
}

function toSuggestion(
  group: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
  reason: SmartFolderReason,
): SmartFolderSuggestion {
  const ordered = [...group].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const sessionIds = ordered.map((session) => session.id);
  return {
    id: `${reason}:${sessionIds.slice().sort().join(",")}`,
    name: suggestFolderName(ordered, participantsBySession, owner, reason),
    reason,
    sessionIds,
    titles: uniqueTitles(ordered),
  };
}

function suggestFolderName(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
  reason: SmartFolderReason,
): string {
  const audience = sessionAudience(sessions[0]!, participantsBySession, owner);
  const confirmedInternal = hasConfirmedInternal(
    sessions,
    participantsBySession,
    owner,
  );
  const company = majorityCompany(sessions, participantsBySession, owner);
  const topic = sharedTopic(sessions);
  const names = sharedParticipantNames(sessions, participantsBySession, owner);
  const internalName = (value: string) =>
    confirmedInternal ? `Internal · ${value}` : value;

  if (audience === "external" && company) {
    if (topic && !includesNormalized(company, topic)) {
      return clipFolderName(`${company} · ${topic}`);
    }
    return clipFolderName(company);
  }

  if (reason === "same_series") {
    const titled = sessions.find((session) => session.title.trim());
    if (titled?.title.trim()) {
      return clipFolderName(titled.title.trim());
    }
  }

  if (reason === "matching_title") {
    const titled = sessions.find((session) => sessionTitleKey(session.title));
    if (titled) {
      const title = titled.title.trim();
      if (company && !includesNormalized(title, company)) {
        return clipFolderName(`${company} · ${topic || title}`);
      }
      return clipFolderName(title);
    }
  }

  if (topic) {
    return clipFolderName(internalName(topic));
  }

  if (names.length === 1) {
    return clipFolderName(
      confirmedInternal
        ? internalName(names[0] ?? "")
        : `Meetings with ${names[0]}`,
    );
  }
  if (names.length === 2) {
    return clipFolderName(internalName(`${names[0]} and ${names[1]}`));
  }
  if (names.length > 2) {
    return clipFolderName(internalName(`${names[0]}, ${names[1]}`));
  }

  const fallback = sessions.find((session) => sessionTitleKey(session.title));
  if (confirmedInternal) {
    return clipFolderName(
      fallback?.title.trim() ? internalName(fallback.title.trim()) : "Internal",
    );
  }
  return clipFolderName(fallback?.title.trim() || "Meetings");
}

function uniquifySuggestionNames(
  suggestions: SmartFolderSuggestion[],
): SmartFolderSuggestion[] {
  const used = new Set<string>();
  return suggestions.map((suggestion) => {
    let name = suggestion.name;
    if (!used.has(normalizeName(name))) {
      used.add(normalizeName(name));
      return suggestion;
    }
    const topic = sharedTopicFromTitles(suggestion.titles);
    if (topic) {
      const next = clipFolderName(
        includesNormalized(name, topic) ? name : `${name} · ${topic}`,
      );
      if (!used.has(normalizeName(next))) {
        used.add(normalizeName(next));
        return { ...suggestion, name: next };
      }
    }
    const suffix = suggestion.sessionIds.length;
    const next = clipFolderName(`${name} (${suffix})`);
    used.add(normalizeName(next));
    return { ...suggestion, name: next };
  });
}

function majorityCompany(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): string | null {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const labels = new Set<string>();
    for (const participant of counterparties(
      session,
      participantsBySession,
      owner,
    )) {
      if (classifyParticipant(participant, owner) !== "external") {
        continue;
      }
      const company =
        participant.organizationName.trim() ||
        companyTermFromEmail(participant.email) ||
        "";
      if (company) {
        labels.add(company);
      }
    }
    for (const label of labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return majorityLabel(counts, sessions.length);
}

function sessionCompanyKey(
  session: SmartFolderSession,
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): string {
  const counts = new Map<string, number>();
  for (const participant of counterparties(
    session,
    participantsBySession,
    owner,
  )) {
    if (classifyParticipant(participant, owner) !== "external") {
      continue;
    }
    const key =
      participant.organizationName.trim().toLowerCase() ||
      emailDomain(participant.email) ||
      "";
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return majorityLabel(counts, 1) ?? "";
}

function sharedTopic(sessions: readonly SmartFolderSession[]): string | null {
  const titleTopic = sharedTopicFromTitles(
    sessions.map((session) => session.title),
  );
  if (titleTopic) {
    return titleTopic;
  }
  return sharedTopicFromTitles(
    sessions.map((session) => session.discussed?.trim() || ""),
  );
}

function sharedTopicFromTitles(titles: readonly string[]): string | null {
  const distinctive = titles
    .map((title) => distinctiveTitle(title))
    .filter(Boolean);
  if (distinctive.length === 0) {
    return null;
  }
  const counts = new Map<string, number>();
  for (const title of distinctive) {
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const shared = majorityLabel(
    counts,
    titles.length,
    sharedTopicThreshold(titles.length),
  );
  if (shared) {
    return shared;
  }
  const tokens = new Map<string, { count: number; label: string }>();
  for (const title of distinctive) {
    const seen = new Set<string>();
    for (const token of title.split(SPACE_REGEX)) {
      const key = token.toLowerCase();
      if (GENERIC_TITLE_TOKENS.has(key) || key.length < 3 || seen.has(key)) {
        continue;
      }
      seen.add(key);
      const current = tokens.get(key);
      if (current) {
        current.count += 1;
      } else {
        tokens.set(key, { count: 1, label: token });
      }
    }
  }
  const required = sharedTopicThreshold(titles.length);
  const sharedTokens = [...tokens.values()]
    .filter((entry) => entry.count >= required)
    .map((entry) => entry.label);
  if (sharedTokens.length === 0) {
    return null;
  }
  return sharedTokens.slice(0, 3).join(" ");
}

function sharedTopicThreshold(sessionCount: number): number {
  return Math.max(2, Math.ceil(sessionCount / 2));
}

function distinctiveTitle(title: string): string {
  const trimmed = title.replace(SPACE_REGEX, " ").trim();
  if (!trimmed || isGenericTitle(trimmed)) {
    return "";
  }
  const kept = trimmed
    .split(SPACE_REGEX)
    .filter((token) => !GENERIC_TITLE_TOKENS.has(token.toLowerCase()));
  return (kept.length > 0 ? kept.join(" ") : trimmed).slice(
    0,
    MAX_FOLDER_NAME_LENGTH,
  );
}

function sharedParticipantNames(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): string[] {
  const audience = sessionAudience(sessions[0]!, participantsBySession, owner);
  let shared: Set<string> | null = null;
  const namesById = new Map<string, string>();
  for (const session of sessions) {
    const ids = clusteringParticipantIds(
      participantsBySession.get(session.id) ?? [],
      owner,
      audience,
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

function sessionAudience(
  session: SmartFolderSession,
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): SessionAudience {
  for (const participant of counterparties(
    session,
    participantsBySession,
    owner,
  )) {
    if (classifyParticipant(participant, owner) === "external") {
      return "external";
    }
  }
  return "internal";
}

function hasConfirmedInternal(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): boolean {
  return sessions.some((session) =>
    counterparties(session, participantsBySession, owner).some(
      (participant) => classifyParticipant(participant, owner) === "internal",
    ),
  );
}

function classifyParticipant(
  participant: SmartFolderParticipant,
  owner: OwnerIdentity,
): "owner" | "internal" | "external" | "unknown" {
  if (participant.source === "excluded" || !participant.humanId) {
    return "unknown";
  }
  if (owner.userId && participant.humanId === owner.userId) {
    return "owner";
  }

  const domain = emailDomain(participant.email);
  const org = participant.organizationName.trim().toLowerCase();
  const hasExternalDomain =
    Boolean(domain) &&
    isBusinessEmail(participant.email) &&
    Boolean(owner.domain) &&
    domain !== owner.domain;
  const hasExternalOrg =
    Boolean(org) &&
    Boolean(owner.organizationName) &&
    org !== owner.organizationName;
  if (hasExternalDomain || hasExternalOrg) {
    return "external";
  }

  const hasInternalDomain =
    Boolean(domain) && Boolean(owner.domain) && domain === owner.domain;
  const hasInternalOrg =
    Boolean(org) &&
    Boolean(owner.organizationName) &&
    org === owner.organizationName;
  if (hasInternalDomain || hasInternalOrg) {
    return "internal";
  }

  if (isBusinessEmail(participant.email) && !owner.domain) {
    return "external";
  }
  if (org && !owner.organizationName) {
    return "external";
  }
  return "unknown";
}

function clusteringParticipantIds(
  participants: readonly SmartFolderParticipant[],
  owner: OwnerIdentity,
  audience: SessionAudience,
): Set<string> {
  const ids = new Set<string>();
  for (const participant of participants) {
    const kind = classifyParticipant(participant, owner);
    if (kind === "owner" || kind === "unknown") {
      continue;
    }
    if (audience === "external" && kind !== "external") {
      continue;
    }
    if (audience === "internal" && kind === "external") {
      continue;
    }
    ids.add(participant.humanId);
  }
  if (ids.size > 0) {
    return ids;
  }
  for (const participant of participants) {
    const kind = classifyParticipant(participant, owner);
    if (kind === "owner") {
      continue;
    }
    if (audience === "external" && kind === "internal") {
      continue;
    }
    if (participant.humanId) {
      ids.add(participant.humanId);
    }
  }
  return ids;
}

function counterparties(
  session: SmartFolderSession,
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  owner: OwnerIdentity,
): SmartFolderParticipant[] {
  return (participantsBySession.get(session.id) ?? []).filter((participant) => {
    return classifyParticipant(participant, owner) !== "owner";
  });
}

function resolveOwnerIdentity(
  sessions: readonly SmartFolderSession[],
  participantsBySession: Map<string, SmartFolderParticipant[]>,
  userId: string | null,
  ownerEmail: string | null,
): OwnerIdentity {
  const ownerId =
    userId?.trim() ||
    sessions.find((session) => session.ownerUserId)?.ownerUserId ||
    null;
  let domain = isBusinessEmail(ownerEmail ?? undefined)
    ? emailDomain(ownerEmail ?? "")
    : null;
  let organizationName: string | null = null;

  for (const session of sessions) {
    for (const participant of participantsBySession.get(session.id) ?? []) {
      if (ownerId && participant.humanId !== ownerId) {
        continue;
      }
      if (!ownerId && participant.humanId !== session.ownerUserId) {
        continue;
      }
      if (!domain && isBusinessEmail(participant.email)) {
        domain = emailDomain(participant.email);
      }
      if (!organizationName && participant.organizationName.trim()) {
        organizationName = participant.organizationName.trim().toLowerCase();
      }
    }
  }

  return { userId: ownerId, domain, organizationName };
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

function emailDomain(email: string): string | null {
  const mailbox = normalizeMailbox(email);
  const domain = mailbox?.split("@")[1];
  return domain || null;
}

function majorityLabel(
  counts: Map<string, number>,
  sessionCount: number,
  minCount = Math.ceil(sessionCount / 2),
): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  if (!best || bestCount < minCount) {
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

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE_KEYS.has(title.toLowerCase().replace(SPACE_REGEX, " "));
}

function includesNormalized(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(SPACE_REGEX, " ").trim();
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
