export function stringField(
  json: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = json[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numberField(
  json: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = json[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function oauthErrorMessage(
  json: Record<string, unknown>,
  fallback: string,
): string {
  return (
    stringField(json, "error_description") ??
    stringField(json, "error") ??
    stringField(json, "message") ??
    fallback
  );
}
