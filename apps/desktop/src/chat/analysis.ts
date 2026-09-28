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
