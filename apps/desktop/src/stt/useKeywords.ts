import { Effect, Option, pipe } from "effect";
import type { UnknownException } from "effect/Cause";
import { toString } from "nlcst-to-string";
import { useMemo } from "react";
import retextEnglish from "retext-english";
import type { Keyphrase, Keyword } from "retext-keywords";
import retextKeywords from "retext-keywords";
import retextPos from "retext-pos";
import retextStringify from "retext-stringify";
import { unified } from "unified";
import type { VFile } from "vfile";

import { useSessionEventParticipants } from "~/calendar/queries";
import { companyTermsFromEmails } from "~/contacts/company-from-email";
import { liveQueryClient } from "~/db";
import { useSession, useSessionParticipants } from "~/session/queries";
import { useConfigValue } from "~/shared/config";
import { rememberLearnedContactTerms } from "~/stt/dictionary-learn";
import { normalizeKeywordList } from "~/stt/keywords";

const MAX_TRANSCRIPTION_HINTS = 50;

export function useKeywords(sessionId: string) {
  const session = useSession(sessionId);
  const participants = useSessionParticipants(sessionId);
  const eventParticipants = useSessionEventParticipants(sessionId);
  const dictionaryTerms = useConfigValue("personalization_dictionary_terms");

  return useMemo(
    () =>
      buildKeywords({
        rawMd: session?.raw_md,
        title: session?.title,
        eventJson: session?.event_json,
        sessionParticipantTerms: participants.flatMap((participant) =>
          participant.source !== "excluded" && participant.name
            ? [participant.name]
            : [],
        ),
        eventParticipantTerms: eventParticipants.flatMap((participant) =>
          !participant.is_current_user && participant.name
            ? [participant.name]
            : [],
        ),
        sessionParticipantEmails: participants.flatMap((participant) =>
          participant.source !== "excluded" && participant.email
            ? [participant.email]
            : [],
        ),
        eventParticipantEmails: eventParticipants.flatMap((participant) =>
          participant.email ? [participant.email] : [],
        ),
        organizationTerms: participants.flatMap((participant) =>
          participant.source !== "excluded" && participant.organizationName
            ? [participant.organizationName]
            : [],
        ),
        dictionaryTerms,
      }),
    [dictionaryTerms, eventParticipants, participants, session],
  );
}

type KeywordSnapshotSqlRow = {
  raw_md: string;
  title: string;
  event_json: string;
  participant_names_json: string;
  participant_emails_json: string;
  participant_orgs_json: string;
  event_participants_json: string;
};

export async function getSessionKeywords({
  sessionId,
  dictionaryTerms,
}: {
  sessionId: string;
  dictionaryTerms: string[];
}): Promise<string[]> {
  const [snapshot] = await liveQueryClient.execute<KeywordSnapshotSqlRow>(
    `
      SELECT
        COALESCE(note.body, '') AS raw_md,
        session.title,
        session.event_json,
        COALESCE((
          SELECT json_group_array(name)
          FROM (
            SELECT COALESCE(NULLIF(human.name, ''), participant.display_name) AS name
            FROM session_participants AS participant
            LEFT JOIN humans AS human
              ON human.id = participant.human_id
              AND human.deleted_at IS NULL
            WHERE participant.session_id = session.id
              AND participant.source <> 'excluded'
              AND participant.deleted_at IS NULL
              AND COALESCE(NULLIF(human.name, ''), participant.display_name) <> ''
            ORDER BY name, participant.id
          )
        ), '[]') AS participant_names_json,
        COALESCE((
          SELECT json_group_array(email)
          FROM (
            SELECT DISTINCT COALESCE(NULLIF(human.email, ''), participant.email) AS email
            FROM session_participants AS participant
            LEFT JOIN humans AS human
              ON human.id = participant.human_id
              AND human.deleted_at IS NULL
            WHERE participant.session_id = session.id
              AND participant.source <> 'excluded'
              AND participant.deleted_at IS NULL
              AND COALESCE(NULLIF(human.email, ''), participant.email) <> ''
            ORDER BY email
          )
        ), '[]') AS participant_emails_json,
        COALESCE((
          SELECT json_group_array(organization)
          FROM (
            SELECT DISTINCT organization.name AS organization
            FROM session_participants AS participant
            LEFT JOIN humans AS human
              ON human.id = participant.human_id
              AND human.deleted_at IS NULL
            LEFT JOIN organizations AS organization
              ON organization.id = human.organization_id
              AND organization.deleted_at IS NULL
            WHERE participant.session_id = session.id
              AND participant.source <> 'excluded'
              AND participant.deleted_at IS NULL
              AND organization.name <> ''
            ORDER BY organization
          )
        ), '[]') AS participant_orgs_json,
        COALESCE((
          SELECT event.participants_json
          FROM events AS event
          WHERE event.deleted_at IS NULL
            AND (
              event.id = session.event_id
              OR (
                event.tracking_id_event = CASE
                  WHEN json_valid(session.event_json)
                  THEN json_extract(session.event_json, '$.tracking_id')
                  ELSE ''
                END
                AND event.calendar_id = CASE
                  WHEN json_valid(session.event_json)
                  THEN json_extract(session.event_json, '$.calendar_id')
                  ELSE ''
                END
              )
            )
          ORDER BY event.started_at, event.id
          LIMIT 1
        ), '[]') AS event_participants_json
      FROM sessions AS session
      LEFT JOIN session_documents AS note
        ON note.id = session.id
        AND note.kind = 'note'
        AND note.deleted_at IS NULL
      WHERE session.id = ? AND session.deleted_at IS NULL
      LIMIT 1
    `,
    [sessionId],
  );

  const sessionParticipantEmails = parseStringList(
    snapshot?.participant_emails_json,
  );
  const eventParticipantEmails = parseEventParticipantEmails(
    snapshot?.event_participants_json,
  );
  const organizationTerms = parseStringList(snapshot?.participant_orgs_json);
  void rememberLearnedContactTerms({
    emails: [...sessionParticipantEmails, ...eventParticipantEmails],
    organizationNames: organizationTerms,
  }).catch((error) => {
    console.warn("[dictionary] failed to learn contact terms", error);
  });

  return buildKeywords({
    rawMd: snapshot?.raw_md,
    title: snapshot?.title,
    eventJson: snapshot?.event_json,
    sessionParticipantTerms: parseStringList(snapshot?.participant_names_json),
    eventParticipantTerms: parseEventParticipantNames(
      snapshot?.event_participants_json,
    ),
    sessionParticipantEmails,
    eventParticipantEmails,
    organizationTerms,
    dictionaryTerms,
  });
}

export function buildKeywords({
  rawMd,
  title,
  eventJson,
  sessionParticipantTerms = [],
  eventParticipantTerms = [],
  sessionParticipantEmails = [],
  eventParticipantEmails = [],
  organizationTerms = [],
  dictionaryTerms,
}: {
  rawMd: unknown;
  title: unknown;
  eventJson: unknown;
  sessionParticipantTerms?: string[];
  eventParticipantTerms?: string[];
  sessionParticipantEmails?: string[];
  eventParticipantEmails?: string[];
  organizationTerms?: string[];
  dictionaryTerms: string[];
}) {
  const sourceText = buildKeywordSourceText({
    rawMd,
    title,
    eventJson,
  });
  const { keywords, keyphrases } =
    sourceText.length > 0
      ? extractKeywordsFromMarkdown(sourceText)
      : { keywords: [], keyphrases: [] };
  const companyTerms = companyTermsFromEmails([
    ...sessionParticipantEmails,
    ...eventParticipantEmails,
  ]);

  return normalizeKeywordList([
    ...sessionParticipantTerms,
    ...eventParticipantTerms,
    ...organizationTerms,
    ...companyTerms,
    ...dictionaryTerms,
    ...keywords,
    ...keyphrases,
  ]).slice(0, MAX_TRANSCRIPTION_HINTS);
}

export function buildKeywordSourceText({
  rawMd,
  title,
  eventJson,
}: {
  rawMd: unknown;
  title: unknown;
  eventJson: unknown;
}): string {
  return [
    stringValue(rawMd),
    stringValue(title),
    ...eventKeywordFields(eventJson),
  ]
    .filter((value) => value.length > 0)
    .join("\n");
}

export const extractKeywordsFromMarkdown = (
  markdown: string,
): { keywords: string[]; keyphrases: string[] } =>
  pipe(
    Effect.succeed(markdown),
    Effect.map(removeCodeBlocks),
    Effect.map((text) => ({
      hashtags: extractHashtags(text),
      cleaned: stripMarkdownFormatting(text),
    })),
    Effect.flatMap(({ cleaned, hashtags }) =>
      cleaned.trim().length === 0
        ? Effect.succeed({ keywords: hashtags, keyphrases: [] })
        : pipe(
            processMarkdown(cleaned),
            Effect.map((file) => gatherKeywords(file, hashtags)),
            Effect.orElse(() =>
              Effect.succeed({
                keywords: hashtags,
                keyphrases: [],
              }),
            ),
          ),
    ),
    Effect.runSync,
  );

const processMarkdown = (
  markdown: string,
): Effect.Effect<VFile, UnknownException, never> =>
  Effect.try(() =>
    unified()
      .use(retextEnglish)
      .use(retextPos)
      .use(retextKeywords, { maximum: 50 })
      .use(retextStringify)
      .processSync(markdown),
  );

const gatherKeywords = (
  file: VFile,
  hashtags: string[],
): { keywords: string[]; keyphrases: string[] } => {
  const keywords = pipe(
    Option.fromNullable(file.data.keywords),
    Option.map((entries) => entries.flatMap(extractKeywordMatches)),
    Option.getOrElse(() => [] as string[]),
  );

  const keyphrases = pipe(
    Option.fromNullable(file.data.keyphrases),
    Option.map((entries) => entries.flatMap(extractKeyphraseMatches)),
    Option.getOrElse(() => [] as string[]),
  );

  return {
    keywords: [...hashtags, ...keywords].filter(
      (keyword) => keyword.length >= 2,
    ),
    keyphrases: keyphrases.filter((phrase) => phrase.length >= 2),
  };
};

const extractKeywordMatches = (keyword: Keyword): string[] =>
  keyword.matches.flatMap((match) => {
    const text = toString(match.node).trim();
    return text.length > 0 ? [text] : [];
  });

const extractKeyphraseMatches = (phrase: Keyphrase): string[] =>
  phrase.matches.flatMap((match) => {
    const text = toString(match.nodes).trim();
    return text.length > 0 ? [text] : [];
  });

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const eventKeywordFields = (eventJson: unknown): string[] => {
  if (typeof eventJson !== "string" || !eventJson) {
    return [];
  }

  try {
    const event = JSON.parse(eventJson);
    return [event?.title, event?.description, event?.location].flatMap(
      (value) => {
        const text = stringValue(value);
        return text ? [text] : [];
      },
    );
  } catch {
    return [];
  }
};

const parseStringList = (value: unknown): string[] => {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
};

const parseEventParticipantEmails = (participantsJson: unknown): string[] => {
  if (typeof participantsJson !== "string" || !participantsJson) {
    return [];
  }

  try {
    const participants = JSON.parse(participantsJson);
    if (!Array.isArray(participants)) {
      return [];
    }

    return participants.flatMap((participant) => {
      const email = stringValue(participant?.email);
      return email ? [email] : [];
    });
  } catch {
    return [];
  }
};

const parseEventParticipantNames = (participantsJson: unknown): string[] => {
  if (typeof participantsJson !== "string" || !participantsJson) {
    return [];
  }

  try {
    const participants = JSON.parse(participantsJson);
    if (!Array.isArray(participants)) {
      return [];
    }

    return participants.flatMap((participant) => {
      if (participant?.is_current_user === true) {
        return [];
      }

      const name = stringValue(participant?.name);
      return name ? [name] : [];
    });
  } catch {
    return [];
  }
};

const removeCodeBlocks = (text: string): string =>
  text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");

const extractHashtags = (text: string): string[] =>
  Array.from(text.matchAll(/#([\p{L}\p{N}_]+)/gu), (match) => match[1]).filter(
    Boolean,
  );

const stripMarkdownFormatting = (text: string): string =>
  text.replace(/[#*_~`[\]()]/g, " ");
