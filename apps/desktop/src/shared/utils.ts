import { getIdentifier } from "@tauri-apps/api/app";

import { env } from "~/env";
import { LOCAL_ONLY } from "~/shared/product";

// export * from "../shared/config/configure-pro-settings";
// export * from "~/sidebar/timeline/utils";
// export * from "~/stt/segment";

export const id = () => crypto.randomUUID() as string;

export type DesktopScheme = "anarlog" | "anarlog-staging" | "anarlog-dev";

function isLoopbackWebAppOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return true;
  }
}

export const hostedDesktopWebFlowsEnabled = (): boolean => {
  if (!LOCAL_ONLY) {
    return true;
  }

  return !isLoopbackWebAppOrigin(env.VITE_APP_URL);
};

export const getScheme = async (): Promise<DesktopScheme> => {
  const id = await getIdentifier();
  const schemes: Record<string, DesktopScheme> = {
    "com.hyprnote.stable": "anarlog",
    "com.hyprnote.Hyprnote": "anarlog",
    "com.hyprnote.staging": "anarlog-staging",
    "com.hyprnote.dev": "anarlog-dev",
    "so.anarlog.Anarlog": "anarlog",
    "com.anarlog.stable": "anarlog",
    "com.anarlog.staging": "anarlog-staging",
    "com.anarlog.dev": "anarlog-dev",
  };
  return schemes[id] ?? "anarlog";
};

type DesktopFlowPath =
  | "/auth"
  | "/app/account"
  | "/app/integration"
  | "/app/checkout"
  | "/app/switch-plan"
  | "/app/portal";

export const buildWebAppUrl = async (
  path: DesktopFlowPath,
  params?: Record<string, string>,
): Promise<string> => {
  const oauthPath = path === "/auth" || path === "/app/integration";
  if (!hostedDesktopWebFlowsEnabled() || (LOCAL_ONLY && !oauthPath)) {
    throw new Error("Web app URLs are disabled in local-only mode");
  }

  const scheme = await getScheme();
  const url = new URL(path, env.VITE_APP_URL);
  url.searchParams.set("flow", "desktop");
  url.searchParams.set("scheme", scheme);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};

// https://www.rfc-editor.org/rfc/rfc4122#section-4.1.7
export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export const DEVICE_FINGERPRINT_HEADER = "x-device-fingerprint";
export const REQUEST_ID_HEADER = "x-request-id";
export const CHAR_TASK_HEADER = "x-char-task";
