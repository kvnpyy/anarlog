import { describe, expect, it } from "vitest";

import {
  applySpeakerIdentityHints,
  identifyTranscriptSpeakers,
} from "./speaker-identity";
import type { SpeakerHintWithId, WordWithId } from "./types";

describe("identifyTranscriptSpeakers", () => {
  it("assigns the local mic to you and the remaining remote to the only invitee", () => {
    const identity = identifyTranscriptSpeakers({
      ownerHumanId: "self",
      participants: [
        { humanId: "self", name: "Kevin" },
        { humanId: "ada", name: "Ada Lovelace" },
      ],
      words: [word("w1", "hello", 0, 0), word("w2", "hi there", 1, 1000, 1)],
      hints: [providerHint("w1", 0, 0), providerHint("w2", 1, 0)],
    });

    expect(identity.assignments).toEqual([
      expect.objectContaining({
        humanId: "self",
        channel: 0,
        source: "closed_set",
      }),
      expect.objectContaining({
        humanId: "ada",
        channel: 1,
        source: "closed_set",
      }),
    ]);
    expect(identity.suggestions).toEqual([]);
  });

  it("labels a cluster from a unique self-introduction", () => {
    const identity = identifyTranscriptSpeakers({
      ownerHumanId: "self",
      participants: [
        { humanId: "ada", name: "Ada" },
        { humanId: "bob", name: "Bob" },
      ],
      words: [
        word("w1", "I'm Ada, thanks for joining", 2, 0),
        word("w2", "sure thing", 2, 2000),
      ],
      hints: [providerHint("w1", 2, 0), providerHint("w2", 2, 1)],
    });

    expect(identity.assignments).toEqual([
      expect.objectContaining({
        humanId: "ada",
        speakerIndex: 0,
        source: "language_cue",
      }),
      expect.objectContaining({
        humanId: "bob",
        speakerIndex: 1,
        source: "closed_set",
      }),
    ]);
  });

  it("auto-assigns a high-margin voiceprint and suggests a weaker one", () => {
    const identity = identifyTranscriptSpeakers({
      ownerHumanId: "self",
      participants: [
        { humanId: "ada", name: "Ada" },
        { humanId: "bob", name: "Bob" },
        { humanId: "cam", name: "Cam" },
      ],
      words: [
        word("w1", "hello", 2, 0),
        word("w2", "hello back", 2, 1000),
        word("w3", "and me", 2, 2000),
      ],
      hints: [
        providerHint("w1", 2, 0),
        providerHint("w2", 2, 1),
        providerHint("w3", 2, 2),
      ],
      voiceprintMatches: [
        {
          speakerChannel: 2,
          speakerIndex: 0,
          humanId: "ada",
          score: 0.9,
          runnerUpScore: 0.7,
        },
        {
          speakerChannel: 2,
          speakerIndex: 1,
          humanId: "bob",
          score: 0.68,
          runnerUpScore: 0.64,
        },
      ],
    });

    expect(identity.assignments).toEqual([
      expect.objectContaining({
        humanId: "ada",
        speakerIndex: 0,
        source: "voiceprint",
      }),
    ]);
    expect(identity.suggestions).toEqual([
      expect.objectContaining({
        humanId: "bob",
        speakerIndex: 1,
        source: "voiceprint",
      }),
    ]);
  });

  it("uses a language cue to break a thin voiceprint margin", () => {
    const identity = identifyTranscriptSpeakers({
      ownerHumanId: "self",
      participants: [
        { humanId: "ada", name: "Ada" },
        { humanId: "bob", name: "Bob" },
      ],
      words: [
        word("w1", "this is Ada speaking", 2, 0),
        word("w2", "thanks Ada", 2, 1000),
      ],
      hints: [providerHint("w1", 2, 0), providerHint("w2", 2, 1)],
      voiceprintMatches: [
        {
          speakerChannel: 2,
          speakerIndex: 0,
          humanId: "ada",
          score: 0.7,
          runnerUpScore: 0.68,
        },
      ],
    });

    expect(identity.assignments).toEqual([
      expect.objectContaining({
        humanId: "ada",
        speakerIndex: 0,
        source: "language_cue",
      }),
      expect.objectContaining({
        humanId: "bob",
        speakerIndex: 1,
        source: "closed_set",
      }),
    ]);
  });

  it("does not invent names outside the invite list", () => {
    const identity = identifyTranscriptSpeakers({
      ownerHumanId: "self",
      participants: [{ humanId: "ada", name: "Ada" }],
      words: [word("w1", "I'm Mallory", 2, 0), word("w2", "ok", 2, 1000)],
      hints: [providerHint("w1", 2, 0), providerHint("w2", 2, 1)],
      voiceprintMatches: [
        {
          speakerChannel: 2,
          speakerIndex: 0,
          humanId: "mallory",
          score: 0.95,
          runnerUpScore: 0.1,
        },
      ],
    });

    expect(identity.assignments).toEqual([]);
    expect(identity.suggestions).toEqual([]);
  });
});

describe("applySpeakerIdentityHints", () => {
  it("replaces previous identity hints without touching enhance assignments", () => {
    const next = applySpeakerIdentityHints(
      [
        {
          id: "w1:automatic_speaker_assignment",
          word_id: "w1",
          type: "automatic_speaker_assignment",
          value: JSON.stringify({
            human_id: "old",
            source: "voiceprint",
          }),
        },
        {
          id: "w2:automatic_speaker_assignment",
          word_id: "w2",
          type: "automatic_speaker_assignment",
          value: JSON.stringify({
            human_id: "kept",
            source: "enhance",
          }),
        },
      ],
      {
        assignments: [
          {
            humanId: "ada",
            channel: 2,
            speakerIndex: 0,
            anchorWordId: "w1",
            confidence: 0.9,
            source: "voiceprint",
          },
        ],
        suggestions: [
          {
            humanId: "bob",
            channel: 2,
            speakerIndex: 1,
            anchorWordId: "w3",
            confidence: 0.66,
            source: "voiceprint",
          },
        ],
      },
    );

    expect(next.map((hint) => hint.type)).toEqual([
      "automatic_speaker_assignment",
      "automatic_speaker_assignment",
      "suggested_speaker_assignment",
    ]);
    expect(JSON.parse(String(next[0]!.value))).toMatchObject({
      human_id: "kept",
      source: "enhance",
    });
    expect(JSON.parse(String(next[1]!.value))).toMatchObject({
      human_id: "ada",
      source: "voiceprint",
    });
  });
});

function word(
  id: string,
  text: string,
  channel: number,
  startMs: number,
  speakerIndex?: number,
): WordWithId {
  return {
    id,
    text,
    start_ms: startMs,
    end_ms: startMs + 500,
    channel,
    ...(typeof speakerIndex === "number"
      ? { speaker: String(speakerIndex) }
      : {}),
  };
}

function providerHint(
  wordId: string,
  channel: number,
  speakerIndex: number,
): SpeakerHintWithId {
  return {
    id: `${wordId}:provider_speaker_index`,
    word_id: wordId,
    type: "provider_speaker_index",
    value: JSON.stringify({ channel, speaker_index: speakerIndex }),
  };
}
