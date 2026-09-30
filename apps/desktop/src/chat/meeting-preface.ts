import { loadSessionInviteAttendees } from "~/calendar/queries";
import {
  accountFactsForDomains,
  emailDomain,
  factsFromUserCorrection,
  rememberAccountFacts,
} from "~/chat/account-memory";
import {
  emailLocalName,
  formatInviteAttendee,
  questionNeedsSmarterModel,
} from "~/chat/analysis";
import { loadPriorMeetingBriefs } from "~/chat/tools/note-files";

const ACCOUNT_HISTORY =
  /\b(how did i do|sales perspective|discovery call|last call|previous call|earlier call|last time|before this)\b/i;

const EMAIL_DRAFT =
  /\b(draft|write|send)\b[\s\S]{0,40}\b(email|e-mail|follow-up|follow up)\b|\bfollow-up email\b|\bemail them\b/i;

export function questionNeedsAccountHistory(text: string): boolean {
  return questionNeedsSmarterModel(text) || ACCOUNT_HISTORY.test(text);
}

export function isEmailDraftRequest(text: string): boolean {
  return EMAIL_DRAFT.test(text);
}

function normalizeSpeech(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function draftUsesOtherPartyVoice(
  draft: string,
  transcript: string,
  senderName: string,
): boolean {
  if (draftAddressesSender(draft, senderName)) {
    return true;
  }

  const saidBySender = new Set<string>();
  const saidByOthers: string[] = [];
  for (const line of transcript.split("\n")) {
    const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const speaker = match[1].trim();
    const text = match[2];
    for (const sentence of text.split(/[.!?]/)) {
      const normalized = normalizeSpeech(sentence);
      if (
        !/\b(we|we're|our)\b/.test(normalized) ||
        normalized.split(" ").length < 4
      ) {
        continue;
      }
      if (speaker === "You") {
        saidBySender.add(normalized);
      } else {
        saidByOthers.push(normalized);
      }
    }
  }

  const draftText = normalizeSpeech(draft);
  return saidByOthers.some(
    (phrase) => !saidBySender.has(phrase) && draftText.includes(phrase),
  );
}

export function draftAddressesSender(
  draft: string,
  senderName: string,
): boolean {
  const first = senderName.trim().split(/\s+/)[0] ?? "";
  if (first.length < 2) {
    return false;
  }
  const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const greeting = new RegExp(`^(hi|hey|hello|dear)\\s+${escaped}\\b`, "i");
  return draft
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^subject:/i.test(line))
    .slice(0, 4)
    .some((line) => greeting.test(line));
}

export function buildIdentityCard(input: {
  senderName?: string | null;
  attendees: Array<{ name?: string | null; email?: string | null }>;
}): string {
  const sender = input.senderName?.trim() || "the Acorn user";
  const senderKey = sender.toLowerCase().replace(/[^a-z0-9]/g, "");
  const recipients = input.attendees.flatMap((attendee) => {
    const label = formatInviteAttendee(attendee);
    if (!label) {
      return [];
    }
    const reading = attendee.email ? emailLocalName(attendee.email) : null;
    const keys = [attendee.name, reading, attendee.email]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (senderKey && keys.some((key) => key.includes(senderKey))) {
      return [];
    }
    return [label];
  });

  const recipientLines =
    recipients.length > 0
      ? recipients.map((recipient) => `- ${recipient}`).join("\n")
      : "- Everyone on the invite except the sender";

  return [
    "Meeting identity. Do not reinterpret who is speaking.",
    `Sender: ${sender}. This is the only I. Transcript lines labeled You: are the sender.`,
    "Recipients:",
    recipientLines,
    'Their "we" and "our" mean "you" and "your" in anything written for the sender.',
  ].join("\n");
}

export async function loadMeetingPreface(input: {
  sessionId: string;
  userTexts: string[];
  senderName?: string | null;
  isPro: boolean;
}): Promise<string> {
  const attendees = await loadSessionInviteAttendees(input.sessionId);
  let identity = buildIdentityCard({
    senderName: input.senderName,
    attendees,
  });
  const domains = attendees.flatMap((attendee) => {
    const domain = emailDomain(attendee.email);
    return domain ? [domain] : [];
  });
  const facts = input.userTexts.flatMap(factsFromUserCorrection);
  try {
    if (facts.length > 0) {
      await rememberAccountFacts(domains, facts);
    }
    const known = await accountFactsForDomains(domains);
    if (known.length > 0) {
      identity = `${identity}\n\nAccount facts:\n${known
        .map((fact) => `- ${fact}`)
        .join("\n")}`;
    }
  } catch (error) {
    console.error("Failed to load account facts", error);
  }
  try {
    const prior = await loadPriorMeetingBriefs(input.sessionId, input.isPro);
    return prior ? `${identity}\n\n${prior}` : identity;
  } catch (error) {
    console.error("Failed to load prior meetings", error);
    return identity;
  }
}
