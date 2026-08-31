import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export async function readJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.trim() || `HTTP ${response.status}`);
  }
}

export async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await tauriFetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return { status: response.status, json: await readJson(response) };
}

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
