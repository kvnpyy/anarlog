import { getStoredSettingValues, setSettingValues } from "~/settings/queries";
import type { SettingValues } from "~/settings/schema";
import {
  ACORN_HOSTED_SONNET_MODEL,
  getAcornDefaultLlm,
  resolveAcornHostedLlmModel,
} from "~/shared/acorn-defaults";

export type AcornProSource =
  | "invite"
  | "dev"
  | "share"
  | "share_invitee"
  | "linkedin";

const DAY_MS = 86_400_000;

export async function setAcornProEntitlement(
  enabled: boolean,
  source: AcornProSource | null = null,
  expiresAt: string | null = null,
): Promise<void> {
  const stored = await getStoredSettingValues();
  const updates: SettingValues = {
    acorn_pro: enabled,
    acorn_pro_source: enabled
      ? (source ?? (stored.values.acorn_pro_source || "dev"))
      : "",
    acorn_pro_expires_at: enabled ? (expiresAt ?? "") : "",
  };

  const defaultLlm = getAcornDefaultLlm();
  const provider = stored.values.current_llm_provider ?? defaultLlm?.providerId;
  if (defaultLlm && provider === defaultLlm.providerId) {
    updates.current_llm_model = enabled
      ? ACORN_HOSTED_SONNET_MODEL
      : resolveAcornHostedLlmModel(
          stored.values.current_llm_model ?? defaultLlm.model,
          false,
        );
  }

  await setSettingValues(updates);
}

// Free-month rewards add onto any time already left so they stack.
// Pro with no expiry (invite or dev) is already unlimited and stays as is.
export async function extendAcornPro(
  source: AcornProSource,
  days: number,
  nowMs = Date.now(),
): Promise<string | null> {
  const stored = await getStoredSettingValues();
  const { acorn_pro: active, acorn_pro_expires_at: expiresAt } = stored.values;
  if (active === true && !expiresAt) {
    return null;
  }

  const currentMs = active === true ? Date.parse(expiresAt ?? "") : Number.NaN;
  const baseMs =
    Number.isFinite(currentMs) && currentMs > nowMs ? currentMs : nowMs;
  const nextExpiresAt = new Date(baseMs + days * DAY_MS).toISOString();
  await setAcornProEntitlement(true, source, nextExpiresAt);
  return nextExpiresAt;
}
