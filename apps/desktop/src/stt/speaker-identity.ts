import type { SpeakerHintWithId, WordWithId } from "~/stt/types";

export const AUTOMATIC_SPEAKER_ASSIGNMENT = "automatic_speaker_assignment";
export const USER_SPEAKER_ASSIGNMENT = "user_speaker_assignment";
export const SUGGESTED_SPEAKER_ASSIGNMENT = "suggested_speaker_assignment";
export const PROVIDER_SPEAKER_INDEX = "provider_speaker_index";

export const IDENTITY_SOURCES = [
  "closed_set",
  "language_cue",
  "voiceprint",
] as const;

export type SpeakerIdentitySource = (typeof IDENTITY_SOURCES)[number];

export const AUTO_VOICEPRINT_SCORE = 0.78;
export const AUTO_VOICEPRINT_MARGIN = 0.08;
export const SUGGEST_VOICEPRINT_SCORE = 0.62;
const LANGUAGE_CUE_CONFIDENCE = 0.86;
const CLOSED_SET_CONFIDENCE = 0.84;

const IDENTITY_SOURCE_SET = new Set<string>(IDENTITY_SOURCES);

export type SpeakerIdentityParticipant = {
  humanId: string;
  name: string;
};

export type VoiceprintMatchInput = {
  speakerChannel: number;
  speakerIndex: number | null;
  humanId: string;
  score: number;
  runnerUpScore: number | null;
};

export type SpeakerIdentityDecision = {
  humanId: string;
  channel: number;
  speakerIndex: number | null;
  anchorWordId: string;
  confidence: number;
  source: SpeakerIdentitySource;
};

export type SpeakerIdentityResult = {
  assignments: SpeakerIdentityDecision[];
  suggestions: SpeakerIdentityDecision[];
};

export function identifyTranscriptSpeakers({
  ownerHumanId,
  participants,
  words,
  hints,
  voiceprintMatches = [],
}: {
  ownerHumanId: string | null | undefined;
  participants: SpeakerIdentityParticipant[];
  words: WordWithId[];
  hints: SpeakerHintWithId[];
  voiceprintMatches?: VoiceprintMatchInput[];
}): SpeakerIdentityResult {
  const clusters = buildSpeakerClusters(words, hints);
  if (clusters.length === 0) {
    return { assignments: [], suggestions: [] };
  }

  const assignedByCluster = assignedClusterKeys(hints, clusters);
  const assignments: SpeakerIdentityDecision[] = [];
  const usedHumans = new Set<string>();

  for (const humanId of assignedByCluster.values()) {
    usedHumans.add(humanId);
  }

  const remainingClusters = () =>
    clusters.filter((cluster) => !assignedByCluster.has(cluster.key));

  if (ownerHumanId) {
    for (const cluster of remainingClusters()) {
      if (cluster.channel !== 0) {
        continue;
      }
      commitAssignment(
        {
          humanId: ownerHumanId,
          channel: cluster.channel,
          speakerIndex: cluster.speakerIndex,
          anchorWordId: cluster.anchorWordId,
          confidence: CLOSED_SET_CONFIDENCE,
          source: "closed_set",
        },
        assignedByCluster,
        usedHumans,
        assignments,
      );
    }
  }

  const invitees = uniqueNamedInvitees(participants, ownerHumanId);
  const clusterCues = new Map(
    remainingClusters().map((cluster) => [
      cluster.key,
      languageCuesForCluster(
        cluster.text,
        remainingInvitees(invitees, usedHumans),
      ),
    ]),
  );

  for (const match of voiceprintMatches) {
    const cluster = remainingClusters().find(
      (item) =>
        item.channel === match.speakerChannel &&
        item.speakerIndex === match.speakerIndex,
    );
    if (!cluster || usedHumans.has(match.humanId)) {
      continue;
    }
    if (
      !remainingInvitees(invitees, usedHumans).some(
        (invitee) => invitee.humanId === match.humanId,
      )
    ) {
      continue;
    }

    const cues = clusterCues.get(cluster.key);
    const margin = match.score - (match.runnerUpScore ?? 0);
    const selfIdAgrees = cues?.selfIds.includes(match.humanId) ?? false;
    const addressed = cues?.addressed.includes(match.humanId) ?? false;
    const auto =
      !addressed &&
      (selfIdAgrees
        ? match.score >= SUGGEST_VOICEPRINT_SCORE
        : match.score >= AUTO_VOICEPRINT_SCORE &&
          margin >= AUTO_VOICEPRINT_MARGIN);

    if (auto) {
      commitAssignment(
        {
          humanId: match.humanId,
          channel: cluster.channel,
          speakerIndex: cluster.speakerIndex,
          anchorWordId: cluster.anchorWordId,
          confidence: clampConfidence(match.score),
          source: selfIdAgrees ? "language_cue" : "voiceprint",
        },
        assignedByCluster,
        usedHumans,
        assignments,
      );
    }
  }

  for (const cluster of remainingClusters()) {
    const remaining = remainingInvitees(invitees, usedHumans);
    const cues = languageCuesForCluster(cluster.text, remaining);
    clusterCues.set(cluster.key, cues);
    if (cues.selfIds.length !== 1) {
      continue;
    }
    commitAssignment(
      {
        humanId: cues.selfIds[0]!,
        channel: cluster.channel,
        speakerIndex: cluster.speakerIndex,
        anchorWordId: cluster.anchorWordId,
        confidence: LANGUAGE_CUE_CONFIDENCE,
        source: "language_cue",
      },
      assignedByCluster,
      usedHumans,
      assignments,
    );
  }

  const leftoverClusters = remainingClusters();
  const leftoverHumans = remainingInvitees(invitees, usedHumans);
  if (leftoverClusters.length === 1 && leftoverHumans.length === 1) {
    const cluster = leftoverClusters[0]!;
    const human = leftoverHumans[0]!;
    commitAssignment(
      {
        humanId: human.humanId,
        channel: cluster.channel,
        speakerIndex: cluster.speakerIndex,
        anchorWordId: cluster.anchorWordId,
        confidence: CLOSED_SET_CONFIDENCE,
        source: "closed_set",
      },
      assignedByCluster,
      usedHumans,
      assignments,
    );
  }

  const suggestions: SpeakerIdentityDecision[] = [];
  const assignedHumanIds = new Set(assignments.map((item) => item.humanId));
  for (const match of voiceprintMatches) {
    const cluster = remainingClusters().find(
      (item) =>
        item.channel === match.speakerChannel &&
        item.speakerIndex === match.speakerIndex,
    );
    if (
      !cluster ||
      assignedHumanIds.has(match.humanId) ||
      usedHumans.has(match.humanId)
    ) {
      continue;
    }
    if (
      !remainingInvitees(invitees, usedHumans).some(
        (invitee) => invitee.humanId === match.humanId,
      )
    ) {
      continue;
    }
    if (match.score < SUGGEST_VOICEPRINT_SCORE) {
      continue;
    }
    const cues = clusterCues.get(cluster.key);
    if (cues?.addressed.includes(match.humanId)) {
      continue;
    }
    suggestions.push({
      humanId: match.humanId,
      channel: cluster.channel,
      speakerIndex: cluster.speakerIndex,
      anchorWordId: cluster.anchorWordId,
      confidence: clampConfidence(match.score),
      source: "voiceprint",
    });
  }

  return { assignments, suggestions };
}

export function applySpeakerIdentityHints(
  hints: SpeakerHintWithId[],
  identity: SpeakerIdentityResult,
): SpeakerHintWithId[] {
  const nextHints = hints.filter((hint) => !isReplaceableIdentityHint(hint));

  for (const assignment of identity.assignments) {
    nextHints.push(
      createIdentityHint(AUTOMATIC_SPEAKER_ASSIGNMENT, assignment),
    );
  }
  for (const suggestion of identity.suggestions) {
    nextHints.push(
      createIdentityHint(SUGGESTED_SPEAKER_ASSIGNMENT, suggestion),
    );
  }

  return nextHints;
}

export function collectSuggestedSpeakerAssignments(
  hints: Array<{ type?: string; value?: unknown }>,
): Array<{
  channel: number;
  speakerIndex: number | null;
  humanId: string;
}> {
  const suggestions: Array<{
    channel: number;
    speakerIndex: number | null;
    humanId: string;
  }> = [];

  for (const hint of hints) {
    if (hint.type !== SUGGESTED_SPEAKER_ASSIGNMENT) {
      continue;
    }
    const value = parseHintValue(hint.value);
    if (!value || typeof value !== "object") {
      continue;
    }
    const humanId = (value as { human_id?: unknown }).human_id;
    const channel = (value as { channel?: unknown }).channel;
    const speakerIndex = (value as { speaker_index?: unknown }).speaker_index;
    if (
      typeof humanId !== "string" ||
      !humanId ||
      (channel !== 0 && channel !== 1 && channel !== 2)
    ) {
      continue;
    }
    if (
      typeof speakerIndex !== "number" &&
      speakerIndex !== null &&
      speakerIndex !== undefined
    ) {
      continue;
    }
    suggestions.push({
      channel,
      speakerIndex: typeof speakerIndex === "number" ? speakerIndex : null,
      humanId,
    });
  }

  return suggestions;
}

function commitAssignment(
  assignment: SpeakerIdentityDecision,
  assignedByCluster: Map<string, string>,
  usedHumans: Set<string>,
  assignments: SpeakerIdentityDecision[],
) {
  const key = clusterKey(assignment.channel, assignment.speakerIndex);
  if (assignedByCluster.has(key) || usedHumans.has(assignment.humanId)) {
    return;
  }
  assignedByCluster.set(key, assignment.humanId);
  usedHumans.add(assignment.humanId);
  assignments.push(assignment);
}

function uniqueNamedInvitees(
  participants: SpeakerIdentityParticipant[],
  ownerHumanId: string | null | undefined,
): SpeakerIdentityParticipant[] {
  const seen = new Set<string>();
  const invitees: SpeakerIdentityParticipant[] = [];
  for (const participant of participants) {
    const humanId = participant.humanId.trim();
    const name = participant.name.trim();
    if (!humanId || !name || humanId === ownerHumanId || seen.has(humanId)) {
      continue;
    }
    seen.add(humanId);
    invitees.push({ humanId, name });
  }
  return invitees;
}

function remainingInvitees(
  invitees: SpeakerIdentityParticipant[],
  usedHumans: Set<string>,
) {
  return invitees.filter((invitee) => !usedHumans.has(invitee.humanId));
}

type SpeakerCluster = {
  key: string;
  channel: number;
  speakerIndex: number | null;
  anchorWordId: string;
  wordIds: Set<string>;
  text: string;
};

function buildSpeakerClusters(
  words: WordWithId[],
  hints: SpeakerHintWithId[],
): SpeakerCluster[] {
  const speakerByWordId = new Map<
    string,
    { channel: number; speakerIndex: number | null }
  >();

  for (const hint of hints) {
    if (
      hint.type !== PROVIDER_SPEAKER_INDEX ||
      typeof hint.word_id !== "string"
    ) {
      continue;
    }
    const value = parseHintValue(hint.value);
    if (!value || typeof value !== "object") {
      continue;
    }
    const speakerIndex = (value as { speaker_index?: unknown }).speaker_index;
    const hintedChannel = (value as { channel?: unknown }).channel;
    if (typeof speakerIndex !== "number") {
      continue;
    }
    speakerByWordId.set(hint.word_id, {
      channel: typeof hintedChannel === "number" ? hintedChannel : -1,
      speakerIndex,
    });
  }

  const wordsByCluster = new Map<string, WordWithId[]>();
  const channelByCluster = new Map<string, number>();
  const indexByCluster = new Map<string, number | null>();
  for (const word of words) {
    if (!word.id || typeof word.channel !== "number") {
      continue;
    }
    const hinted = speakerByWordId.get(word.id);
    const channel =
      hinted && hinted.channel >= 0 ? hinted.channel : word.channel;
    const speakerIndex = hinted?.speakerIndex ?? null;
    const key = clusterKey(channel, speakerIndex);
    const clusterWords = wordsByCluster.get(key) ?? [];
    clusterWords.push(word);
    wordsByCluster.set(key, clusterWords);
    channelByCluster.set(key, channel);
    indexByCluster.set(key, speakerIndex);
  }

  return [...wordsByCluster.entries()]
    .map(([key, clusterWords]) => {
      const sorted = [...clusterWords].sort(
        (left, right) => (left.start_ms ?? 0) - (right.start_ms ?? 0),
      );
      const first = sorted[0]!;
      return {
        key,
        channel: channelByCluster.get(key) ?? first.channel ?? 0,
        speakerIndex: indexByCluster.get(key) ?? null,
        anchorWordId: first.id,
        wordIds: new Set(sorted.map((word) => word.id)),
        text: sorted.map((word) => word.text).join(""),
      };
    })
    .filter((cluster) => cluster.anchorWordId)
    .sort((left, right) => left.key.localeCompare(right.key));
}

function assignedClusterKeys(
  hints: SpeakerHintWithId[],
  clusters: SpeakerCluster[],
): Map<string, string> {
  const assigned = new Map<string, string>();

  for (const hint of hints) {
    if (
      hint.type !== AUTOMATIC_SPEAKER_ASSIGNMENT &&
      hint.type !== USER_SPEAKER_ASSIGNMENT
    ) {
      continue;
    }
    const value = parseHintValue(hint.value);
    if (!value || typeof value !== "object") {
      continue;
    }
    const humanId = (value as { human_id?: unknown }).human_id;
    if (typeof humanId !== "string" || !humanId) {
      continue;
    }
    if ((value as { scope?: unknown }).scope === "segment") {
      continue;
    }
    if ((value as { scope?: unknown }).scope === "speaker") {
      const channel = (value as { channel?: unknown }).channel;
      const speakerIndex = (value as { speaker_index?: unknown }).speaker_index;
      if (channel !== 0 && channel !== 1 && channel !== 2) {
        continue;
      }
      assigned.set(
        clusterKey(
          channel,
          typeof speakerIndex === "number" ? speakerIndex : null,
        ),
        humanId,
      );
      continue;
    }
    if (typeof hint.word_id !== "string") {
      continue;
    }
    const wordId = hint.word_id;
    const cluster = clusters.find((item) => item.wordIds.has(wordId));
    if (cluster) {
      assigned.set(cluster.key, humanId);
    }
  }

  return assigned;
}

function languageCuesForCluster(
  text: string,
  invitees: SpeakerIdentityParticipant[],
): { selfIds: string[]; addressed: string[] } {
  const selfIds: string[] = [];
  const addressed: string[] = [];
  if (!text.trim() || invitees.length === 0) {
    return { selfIds, addressed };
  }

  const aliases = invitees.map((invitee) => ({
    humanId: invitee.humanId,
    patterns: nameAliases(invitee.name, invitees),
  }));

  for (const invitee of aliases) {
    if (
      invitee.patterns.some((pattern) =>
        selfIdentificationPattern(pattern).test(text),
      )
    ) {
      selfIds.push(invitee.humanId);
    }
    if (
      invitee.patterns.some((pattern) => addressPattern(pattern).test(text))
    ) {
      addressed.push(invitee.humanId);
    }
  }

  return { selfIds, addressed };
}

function nameAliases(
  name: string,
  invitees: SpeakerIdentityParticipant[],
): string[] {
  const normalized = normalizeName(name);
  if (!normalized) {
    return [];
  }
  const given = normalized.split(/\s+/u)[0] ?? "";
  const givenIsUnique =
    given.length >= 2 &&
    !NAME_STOP_WORDS.has(given) &&
    invitees.every((invitee) => {
      if (normalizeName(invitee.name) === normalized) {
        return true;
      }
      return (normalizeName(invitee.name).split(/\s+/u)[0] ?? "") !== given;
    });

  return givenIsUnique && given !== normalized
    ? [normalized, given]
    : [normalized];
}

function selfIdentificationPattern(name: string): RegExp {
  const escaped = escapeRegExp(name);
  return new RegExp(
    `(?:\\b(?:i(?:['’]m| am)|this is|my name is)\\s+${escaped}\\b|\\b${escaped}\\s+speaking\\b)`,
    "iu",
  );
}

function addressPattern(name: string): RegExp {
  const escaped = escapeRegExp(name);
  return new RegExp(
    `\\b(?:thanks|thank you|hi|hey|hello)\\s*,?\\s+${escaped}\\b`,
    "iu",
  );
}

function isReplaceableIdentityHint(hint: SpeakerHintWithId): boolean {
  if (hint.type === SUGGESTED_SPEAKER_ASSIGNMENT) {
    return true;
  }
  if (hint.type !== AUTOMATIC_SPEAKER_ASSIGNMENT) {
    return false;
  }
  const value = parseHintValue(hint.value);
  if (!value || typeof value !== "object") {
    return false;
  }
  const source = (value as { source?: unknown }).source;
  return typeof source === "string" && IDENTITY_SOURCE_SET.has(source);
}

function createIdentityHint(
  type: string,
  assignment: SpeakerIdentityDecision,
): SpeakerHintWithId {
  return {
    id: `${assignment.anchorWordId}:${type}:${assignment.channel}:${assignment.speakerIndex ?? "none"}`,
    word_id: assignment.anchorWordId,
    type,
    value: JSON.stringify({
      human_id: assignment.humanId,
      scope: "speaker",
      channel: assignment.channel,
      speaker_index: assignment.speakerIndex,
      confidence: assignment.confidence,
      source: assignment.source,
    }),
  };
}

function clusterKey(channel: number, speakerIndex: number | null): string {
  return `${channel}:${speakerIndex ?? "none"}`;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return SUGGEST_VOICEPRINT_SCORE;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeName(name: string): string {
  return name.replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function parseHintValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  return value;
}

const NAME_STOP_WORDS = new Set(
  "am and hi hey hello i i'm im is my name speaking thanks thank the this you".split(
    " ",
  ),
);
