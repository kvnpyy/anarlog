import { numberField, oauthErrorMessage, postForm, stringField } from "./http";
import { createPkce, randomUrlToken } from "./pkce";

import { env } from "~/env";

export const GOOGLE_CALENDAR_CLIENT_ID =
  "675191343557-ii0ia4pdgv64jrm1vav9nrgf417kpgva.apps.googleusercontent.com";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
].join(" ");

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleCalendarCredential = {
  type: "oauth";
  refresh: string;
  access: string;
  expires: number;
};

export type GoogleCalendarConnectSession = {
  url: string;
  redirectUri: string;
  verifier: string;
  state: string;
};

const REFRESH_SKEW_MS = 2 * 60 * 1000;

export function googleLoopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}/auth/callback`;
}

export function encodeAuthorizeQuery(params: Array<[string, string]>) {
  return params
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

export function googleCalendarAuthorizeUrl(input: {
  challenge: string;
  state: string;
  redirectUri: string;
}): string {
  return `${AUTHORIZE_URL}?${encodeAuthorizeQuery([
    ["client_id", GOOGLE_CALENDAR_CLIENT_ID],
    ["redirect_uri", input.redirectUri],
    ["response_type", "code"],
    ["scope", GOOGLE_CALENDAR_SCOPES],
    ["access_type", "offline"],
    ["prompt", "consent"],
    ["include_granted_scopes", "false"],
    ["code_challenge", input.challenge],
    ["code_challenge_method", "S256"],
    ["state", input.state],
  ])}`;
}

export async function startGoogleCalendarConnect(
  port: number,
): Promise<GoogleCalendarConnectSession> {
  const pkce = await createPkce();
  const state = randomUrlToken(16);
  const redirectUri = googleLoopbackRedirectUri(port);
  return {
    url: googleCalendarAuthorizeUrl({
      challenge: pkce.challenge,
      state,
      redirectUri,
    }),
    redirectUri,
    verifier: pkce.verifier,
    state,
  };
}

export function googleAuthFromCallback(search: {
  access_token?: string | null;
  refresh_token?: string | null;
  code?: string | null;
  state?: string | null;
}): { code: string; state?: string } | null {
  const code = search.code?.trim();
  if (!code || search.access_token?.trim() || search.refresh_token?.trim()) {
    return null;
  }

  return {
    code,
    state: search.state?.trim() || undefined,
  };
}

export function assertGoogleAuthorizationState(
  session: GoogleCalendarConnectSession,
  parsed: { state?: string },
) {
  if (parsed.state && parsed.state !== session.state) {
    throw new Error("This Google sign-in expired. Try connecting again.");
  }
}

function googleCalendarTokenBody(body: Record<string, string>) {
  const clientSecret = env.VITE_GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientSecret) {
    return body;
  }
  return { ...body, client_secret: clientSecret };
}

export async function exchangeGoogleCalendarCode(input: {
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<GoogleCalendarCredential> {
  const { status, json } = await postForm(
    TOKEN_URL,
    googleCalendarTokenBody({
      grant_type: "authorization_code",
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.verifier,
    }),
  );
  return credentialFromTokenResponse(
    json,
    status,
    "Could not connect Google Calendar.",
  );
}

export async function refreshGoogleCalendarCredential(
  credential: GoogleCalendarCredential,
): Promise<GoogleCalendarCredential> {
  const { status, json } = await postForm(
    TOKEN_URL,
    googleCalendarTokenBody({
      grant_type: "refresh_token",
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      refresh_token: credential.refresh,
    }),
  );
  return credentialFromTokenResponse(
    json,
    status,
    "Could not refresh Google Calendar.",
    credential,
  );
}

export function isGoogleCalendarCredentialFresh(
  credential: GoogleCalendarCredential,
  now = Date.now(),
): boolean {
  return (
    credential.access.length > 0 && credential.expires - REFRESH_SKEW_MS > now
  );
}

function credentialFromTokenResponse(
  json: Record<string, unknown>,
  status: number,
  fallback: string,
  previous?: GoogleCalendarCredential,
): GoogleCalendarCredential {
  const access = stringField(json, "access_token");
  if (status >= 400 || !access) {
    throw new Error(oauthErrorMessage(json, fallback));
  }

  const refresh = stringField(json, "refresh_token") ?? previous?.refresh ?? "";
  if (!refresh) {
    throw new Error(
      "Google did not return a refresh token. Try connecting again.",
    );
  }

  const expiresIn = numberField(json, "expires_in") ?? 3600;
  return {
    type: "oauth",
    refresh,
    access,
    expires: Date.now() + expiresIn * 1000,
  };
}
