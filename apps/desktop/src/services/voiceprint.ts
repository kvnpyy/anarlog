import { commands as transcriptionCommands } from "@anlg/plugin-transcription";

import { liveQueryClient } from "~/db";
import {
  applySpeakerIdentityToTranscript,
  getTranscriptRecord,
} from "~/stt/queries";
import {
  identifyTranscriptSpeakers,
  type SpeakerIdentityDecision,
  type SpeakerIdentityParticipant,
  type VoiceprintMatchInput,
} from "~/stt/speaker-identity";

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

let lastCleanupMs = 0;

// Piggybacks on the frequent audio-retention tick but only sweeps a few
// times a day: expired candidates are a privacy cleanup, not a hot path.
export async function cleanupExpiredVoiceprintCandidates(
  nowMs = Date.now(),
): Promise<void> {
  if (nowMs - lastCleanupMs < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupMs = nowMs;

  try {
    const result =
      await transcriptionCommands.cleanupExpiredVoiceprintCandidates();
    if (result.status === "error") {
      console.error("[voiceprint] candidate cleanup failed", result.error);
    }
  } catch (error) {
    console.error("[voiceprint] candidate cleanup failed", error);
  }
}

// Runs after a transcript is persisted and before audio retention may delete
// the recording — the embeddings must outlive the audio. Failures are logged
// and swallowed: losing candidates for one session is acceptable, blocking
// transcription completion is not.
export async function maybeExtractVoiceprintCandidates(input: {
  enabled: boolean;
  sessionId: string;
  transcriptId: string;
  audioPath: string | null | undefined;
}): Promise<void> {
  if (!input.enabled || !input.audioPath) {
    return;
  }

  try {
    const result = await transcriptionCommands.extractVoiceprintCandidates(
      input.sessionId,
      input.transcriptId,
      input.audioPath,
    );
    if (result.status === "error") {
      console.error("[voiceprint] candidate extraction failed", result.error);
    }
  } catch (error) {
    console.error("[voiceprint] candidate extraction failed", error);
  }
}

export async function maybeIdentifyTranscriptSpeakers(input: {
  sessionId: string;
  transcriptId: string;
}): Promise<void> {
  try {
    const [transcript, participants, ownerHumanId] = await Promise.all([
      getTranscriptRecord(input.transcriptId),
      loadSessionInvitees(input.sessionId),
      loadSessionOwnerHumanId(input.sessionId),
    ]);
    if (!transcript) {
      return;
    }

    const inviteeIds = participants.map((participant) => participant.humanId);
    const voiceprintMatches = await matchInviteeVoiceprints(
      input.transcriptId,
      inviteeIds,
    );
    const identity = identifyTranscriptSpeakers({
      ownerHumanId,
      participants,
      words: transcript.words,
      hints: transcript.speakerHints,
      voiceprintMatches,
    });

    await applySpeakerIdentityToTranscript(input.transcriptId, identity);
    await promoteIdentityAssignments(input.transcriptId, identity.assignments);
  } catch (error) {
    console.error("[voiceprint] speaker identity failed", error);
  }
}

async function loadSessionOwnerHumanId(
  sessionId: string,
): Promise<string | null> {
  const rows = await liveQueryClient.execute<{ owner_user_id: string }>(
    `
      SELECT owner_user_id
      FROM sessions
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
    `,
    [sessionId],
  );
  return rows[0]?.owner_user_id ?? null;
}

async function loadSessionInvitees(
  sessionId: string,
): Promise<SpeakerIdentityParticipant[]> {
  const rows = await liveQueryClient.execute<{
    human_id: string;
    name: string;
  }>(
    `
      SELECT
        participant.human_id,
        COALESCE(NULLIF(human.name, ''), participant.display_name) AS name
      FROM session_participants AS participant
      LEFT JOIN humans AS human
        ON human.id = participant.human_id AND human.deleted_at IS NULL
      WHERE participant.session_id = ?
        AND participant.human_id <> ''
        AND participant.source <> 'excluded'
        AND participant.deleted_at IS NULL
      ORDER BY participant.human_id
    `,
    [sessionId],
  );

  return rows
    .map((row) => ({
      humanId: row.human_id,
      name: row.name.trim(),
    }))
    .filter((participant) => participant.humanId && participant.name);
}

async function matchInviteeVoiceprints(
  transcriptId: string,
  humanIds: string[],
): Promise<VoiceprintMatchInput[]> {
  if (humanIds.length === 0) {
    return [];
  }

  try {
    const result = await transcriptionCommands.matchVoiceprintCandidates(
      transcriptId,
      humanIds,
    );
    if (result.status === "error") {
      console.error("[voiceprint] candidate match failed", result.error);
      return [];
    }
    return result.data.map((match) => ({
      speakerChannel: match.speakerChannel,
      speakerIndex: match.speakerIndex,
      humanId: match.humanId,
      score: match.score,
      runnerUpScore: match.runnerUpScore,
    }));
  } catch (error) {
    console.error("[voiceprint] candidate match failed", error);
    return [];
  }
}

async function promoteIdentityAssignments(
  transcriptId: string,
  assignments: SpeakerIdentityDecision[],
): Promise<void> {
  for (const assignment of assignments) {
    try {
      const result = await transcriptionCommands.promoteVoiceprintCandidates(
        transcriptId,
        assignment.channel,
        assignment.speakerIndex,
        assignment.humanId,
        confirmationSourceForIdentity(assignment.source),
      );
      if (result.status === "error") {
        console.error("[voiceprint] identity promotion failed", result.error);
      }
    } catch (error) {
      console.error("[voiceprint] identity promotion failed", error);
    }
  }
}

function confirmationSourceForIdentity(
  source: SpeakerIdentityDecision["source"],
): string {
  if (source === "voiceprint") {
    return "voiceprint_match";
  }
  if (source === "language_cue") {
    return "language_cue";
  }
  return "closed_set_assignment";
}
