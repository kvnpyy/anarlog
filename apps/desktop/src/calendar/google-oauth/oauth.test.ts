import { describe, expect, test } from "vitest";

import {
  GOOGLE_CALENDAR_CLIENT_ID,
  GOOGLE_CALENDAR_SCOPES,
  googleAuthFromCallback,
  googleCalendarAuthorizeUrl,
  googleLoopbackRedirectUri,
} from "./oauth";

describe("Google Calendar desktop OAuth", () => {
  test("builds a loopback PKCE authorize URL for the Acorn desktop client", () => {
    const href = googleCalendarAuthorizeUrl({
      challenge: "pkce-challenge",
      state: "oauth-state",
      redirectUri: googleLoopbackRedirectUri(43111),
    });
    const url = new URL(href);

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe(GOOGLE_CALENDAR_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:43111/auth/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
    expect(url.searchParams.get("code_challenge")).toBe("pkce-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("oauth-state");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_CALENDAR_SCOPES);
    expect(href).not.toContain("client_secret");
    expect(href).not.toContain("anarlog");
    expect(href).not.toContain("repedge");
    expect(GOOGLE_CALENDAR_SCOPES).toContain("calendar.readonly");
    expect(GOOGLE_CALENDAR_SCOPES).toContain("calendar.events.readonly");
    expect(GOOGLE_CALENDAR_SCOPES).not.toContain("userinfo");
  });

  test("encodes scope spaces as %20 so macOS open does not split the URL", () => {
    const href = googleCalendarAuthorizeUrl({
      challenge: "c",
      state: "s",
      redirectUri: googleLoopbackRedirectUri(1),
    });
    expect(href).toContain("scope=");
    expect(href).not.toContain("+");
    expect(href).toContain(
      "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly",
    );
  });

  test("reads the loopback authorization code and ignores token logins", () => {
    expect(
      googleAuthFromCallback({
        code: "auth-code",
        state: "s1",
        access_token: "",
        refresh_token: "",
      }),
    ).toEqual({ code: "auth-code", state: "s1" });
    expect(
      googleAuthFromCallback({
        code: "auth-code",
        access_token: "access",
        refresh_token: "refresh",
      }),
    ).toBeNull();
  });
});
