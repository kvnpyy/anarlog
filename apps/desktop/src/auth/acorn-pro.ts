import { getStoredSettingValues, setSettingValues } from "~/settings/queries";
import type { SettingValues } from "~/settings/schema";
import {
  ACORN_HOSTED_SONNET_MODEL,
  getAcornDefaultLlm,
  resolveAcornHostedLlmModel,
} from "~/shared/acorn-defaults";

export type AcornProSource = "invite" | "dev";

export async function setAcornProEntitlement(
  enabled: boolean,
  source: AcornProSource | null = null,
): Promise<void> {
  const stored = await getStoredSettingValues();
  const updates: SettingValues = {
    acorn_pro: enabled,
    acorn_pro_source: enabled
      ? (source ?? (stored.values.acorn_pro_source || "dev"))
      : "",
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
