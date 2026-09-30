const SMARTER_QUESTION =
  /\b(meddpicc|meddpic|meddicc|meddic|bant|spiced|sandler|economic buyer|decision criteria|decision process|paper process|identified pain|identify pain|deal review|deal analysis)\b/i;

export function questionNeedsSmarterModel(text: string): boolean {
  return SMARTER_QUESTION.test(text);
}

export function textFromUiMessage(message: {
  parts?: ReadonlyArray<{ type: string; text?: string }>;
}): string {
  return (message.parts ?? [])
    .filter(
      (part): part is { type: string; text: string } =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

const ROLE_EMAIL_LOCALS = new Set([
  "admin",
  "contact",
  "hello",
  "hi",
  "info",
  "mail",
  "newsletter",
  "no-reply",
  "noreply",
  "office",
  "sales",
  "support",
  "team",
]);

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleCaseEmailPart(part: string): string {
  if (part.length === 1) {
    return part.toUpperCase();
  }
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function emailLocalName(email: string): string | null {
  const local = email.split("@")[0]?.split("+")[0]?.trim().toLowerCase() ?? "";
  if (!local || ROLE_EMAIL_LOCALS.has(local)) {
    return null;
  }

  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return parts.map(titleCaseEmailPart).join(" ");
}

export function formatInviteAttendee(participant: {
  name?: string | null;
  email?: string | null;
}): string | null {
  const name = participant.name?.trim() ?? "";
  const email = participant.email?.trim() ?? "";
  const reading = email ? emailLocalName(email) : null;
  const display = name || reading || "";
  if (!display && !email) {
    return null;
  }

  if (!display) {
    return email || null;
  }
  const labeled = email ? `${display} <${email}>` : display;
  const conflicts =
    name &&
    reading &&
    compactName(name) !== compactName(reading) &&
    !compactName(name).includes(compactName(reading)) &&
    !compactName(reading).includes(compactName(name));
  return conflicts ? `${labeled} (email reads ${reading})` : labeled;
}

export function mentionsAccount(text: string, account: string): boolean {
  const needle = account.trim();
  if (!needle) {
    return true;
  }

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(text);
}
