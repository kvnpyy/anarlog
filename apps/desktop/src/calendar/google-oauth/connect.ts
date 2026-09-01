import { commands as calendarCommands } from "@anlg/plugin-calendar";
import {
  commands as deeplink2Commands,
  events as deeplink2Events,
} from "@anlg/plugin-deeplink2";
import { commands as openerCommands } from "@anlg/plugin-opener2";

import {
  assertGoogleAuthorizationState,
  exchangeGoogleCalendarCode,
  googleAuthFromCallback,
  GoogleOAuthError,
  startGoogleCalendarConnect,
} from "./oauth";
import {
  deleteGoogleCalendarConnection,
  listGoogleCalendarConnections,
  saveGoogleCalendarConnection,
} from "./storage";

import { getScheme } from "~/shared/utils";

const CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

function unwrap<T>(
  result: { status: "ok"; data: T } | { status: "error"; error: string },
): T {
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}

async function listenForGoogleAuthorizationCode(expectedState: string) {
  let settled = false;
  let unlisten: (() => void) | undefined;
  let resolveCode!: (value: { code: string; state?: string }) => void;
  let rejectCode!: (error: Error) => void;
  const code = new Promise<{ code: string; state?: string }>(
    (resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    },
  );
  const timer = window.setTimeout(() => {
    finish(() => rejectCode(new Error("Google Calendar sign-in timed out.")));
  }, CALLBACK_TIMEOUT_MS);

  const finish = (action: () => void) => {
    if (settled) {
      return;
    }
    settled = true;
    window.clearTimeout(timer);
    unlisten?.();
    action();
  };

  unlisten = await deeplink2Events.deepLinkEvent.listen(({ payload }) => {
    if (payload.to !== "/auth/callback") {
      return;
    }
    try {
      const parsed = googleAuthFromCallback(payload.search);
      if (!parsed) {
        return;
      }
      if (parsed.state && parsed.state !== expectedState) {
        return;
      }
      finish(() => resolveCode(parsed));
    } catch (error) {
      const callbackState = payload.search.state?.trim();
      if (callbackState && callbackState !== expectedState) {
        return;
      }
      finish(() =>
        rejectCode(
          error instanceof Error
            ? error
            : new GoogleOAuthError("Could not connect Google Calendar."),
        ),
      );
    }
  });

  return {
    code,
    cancel: () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      unlisten?.();
    },
  };
}

async function accountEmailFromAccessToken(
  accessToken: string,
  fallback: string,
): Promise<string> {
  const result = await calendarCommands.listGoogleCalendarsDirect(accessToken);
  if (result.status === "error") {
    return fallback;
  }

  const primary =
    result.data.find((calendar) => calendar.is_primary) ?? result.data[0];
  return primary?.source || primary?.id || fallback;
}

export async function connectGoogleCalendar(input?: {
  connectionId?: string;
}): Promise<void> {
  const scheme = await getScheme();
  const port = unwrap(
    await deeplink2Commands.startCallbackServer(scheme, null),
  );

  try {
    const session = await startGoogleCalendarConnect(port);
    const authorization = await listenForGoogleAuthorizationCode(session.state);
    try {
      const opened = await openerCommands.openUrl(session.url, null);
      if (opened.status === "error") {
        throw new Error(opened.error);
      }

      const parsed = await authorization.code;
      assertGoogleAuthorizationState(session, parsed);
      const credential = await exchangeGoogleCalendarCode({
        code: parsed.code,
        verifier: session.verifier,
        redirectUri: session.redirectUri,
      });
      const existing = input?.connectionId
        ? (await listGoogleCalendarConnections()).find(
            (connection) => connection.connection_id === input.connectionId,
          )
        : undefined;
      const email = await accountEmailFromAccessToken(
        credential.access,
        existing?.email || "Google Calendar",
      );
      await saveGoogleCalendarConnection({
        connectionId: input?.connectionId,
        email,
        credential,
      });
    } catch (error) {
      authorization.cancel();
      throw error;
    }
  } finally {
    await deeplink2Commands.stopCallbackServer();
  }
}

export async function disconnectGoogleCalendar(
  connectionId: string,
): Promise<void> {
  await deleteGoogleCalendarConnection(connectionId);
}
