import { env } from "~/env";
import { LOCAL_ONLY } from "~/shared/product";
import { commands as desktopCommands } from "~/types/tauri.gen";

export const ACORN_DEFAULT_STT_PROVIDER_ID = "deepgram";
export const ACORN_DEFAULT_LLM_PROVIDER_ID = "acorn";
export const ACORN_DEFAULT_STT_BASE_URL = "https://api.deepgram.com/v1";
export const ACORN_DEFAULT_STT_MODEL = "nova-3-general";
export const ACORN_HOSTED_API_KEY = "acorn-hosted";
export const ACORN_HOSTED_HAIKU_MODEL = "claude-haiku-4-5";
export const ACORN_HOSTED_SONNET_MODEL = "claude-sonnet-4-5";

export type AcornDefaultLlmKind = "openai" | "anthropic" | "google";

type BundledProvider = {
  type: "stt" | "llm";
  base_url: string;
  api_key: string;
};

const LLM_DEFAULTS: Record<
  AcornDefaultLlmKind,
  { baseUrl: string; model: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: ACORN_HOSTED_SONNET_MODEL,
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
};

let hostedStt = false;
let hostedLlm = false;

export function isAcornHostedApiKey(apiKey: string | undefined): boolean {
  return apiKey?.trim() === ACORN_HOSTED_API_KEY;
}

export function hydrateAcornHostedAi(state: { stt?: boolean; llm?: boolean }) {
  hostedStt = Boolean(state.stt);
  hostedLlm = Boolean(state.llm);
}

export async function hydrateAcornHostedFromNative(): Promise<void> {
  if (!LOCAL_ONLY) {
    hydrateAcornHostedAi({});
    return;
  }

  try {
    const status = await desktopCommands.acornHostedAiStatus();
    hydrateAcornHostedAi({
      stt: status.stt,
      llm: status.llm,
    });
  } catch {
    hydrateAcornHostedAi({});
  }
}

export function getAcornDefaultLlmKind(): AcornDefaultLlmKind {
  return env.VITE_ACORN_DEFAULT_LLM_KIND ?? "openai";
}

export function getAcornDefaultStt(): {
  providerId: typeof ACORN_DEFAULT_STT_PROVIDER_ID;
  baseUrl: string;
  apiKey: string;
  model: string;
} | null {
  if (!LOCAL_ONLY || !hostedStt) {
    return null;
  }

  return {
    providerId: ACORN_DEFAULT_STT_PROVIDER_ID,
    baseUrl: ACORN_DEFAULT_STT_BASE_URL,
    apiKey: ACORN_HOSTED_API_KEY,
    model: ACORN_DEFAULT_STT_MODEL,
  };
}

export function getAcornDefaultLlm(): {
  providerId: typeof ACORN_DEFAULT_LLM_PROVIDER_ID;
  kind: AcornDefaultLlmKind;
  baseUrl: string;
  apiKey: string;
  model: string;
} | null {
  if (!LOCAL_ONLY || !hostedLlm) {
    return null;
  }

  const kind = getAcornDefaultLlmKind();
  const defaults = LLM_DEFAULTS[kind];

  return {
    providerId: ACORN_DEFAULT_LLM_PROVIDER_ID,
    kind,
    baseUrl: env.VITE_ACORN_DEFAULT_LLM_BASE_URL?.trim() || defaults.baseUrl,
    apiKey: ACORN_HOSTED_API_KEY,
    model: env.VITE_ACORN_DEFAULT_LLM_MODEL?.trim() || defaults.model,
  };
}

function providerRowId(type: "stt" | "llm", providerId: string): string {
  return `${type}:${providerId}`;
}

function hasApiKey(provider: BundledProvider | undefined): boolean {
  return Boolean(provider?.api_key?.trim());
}

export function withAcornBundledProviders<T extends BundledProvider>(
  type: "stt" | "llm",
  providers: Record<string, T>,
): Record<string, T> {
  if (!LOCAL_ONLY) {
    return providers;
  }

  const next = { ...providers };

  if (type === "stt") {
    const bundled = getAcornDefaultStt();
    const rowId = providerRowId("stt", ACORN_DEFAULT_STT_PROVIDER_ID);
    if (bundled && !hasApiKey(next[rowId])) {
      next[rowId] = {
        ...(next[rowId] as T | undefined),
        type: "stt",
        base_url: bundled.baseUrl,
        api_key: bundled.apiKey,
      } as T;
    }
  }

  if (type === "llm") {
    const bundled = getAcornDefaultLlm();
    const rowId = providerRowId("llm", ACORN_DEFAULT_LLM_PROVIDER_ID);
    if (bundled && !hasApiKey(next[rowId])) {
      next[rowId] = {
        ...(next[rowId] as T | undefined),
        type: "llm",
        base_url: bundled.baseUrl,
        api_key: bundled.apiKey,
      } as T;
    }
  }

  return next;
}

export type AcornHostedLlmTier = "haiku" | "sonnet";

export function acornHostedLlmTier(
  modelId: string | undefined,
): AcornHostedLlmTier | null {
  if (!modelId) {
    return null;
  }

  const normalized = modelId.toLowerCase();
  if (/(?:^|[^a-z])opus(?:[^a-z]|$)/.test(normalized)) {
    return null;
  }
  if (normalized.includes("haiku")) {
    return "haiku";
  }
  if (normalized.includes("sonnet")) {
    return "sonnet";
  }
  return null;
}

export function filterAcornHostedLlmModels(
  models: readonly string[],
  isPro: boolean,
): string[] {
  const allowed = models.filter((model) => acornHostedLlmTier(model) !== null);
  if (isPro) {
    return allowed;
  }
  return allowed.filter((model) => acornHostedLlmTier(model) === "haiku");
}

export function resolveAcornHostedLlmModel(
  modelId: string | undefined,
  isPro: boolean,
): string {
  const fallback = isPro ? ACORN_HOSTED_SONNET_MODEL : ACORN_HOSTED_HAIKU_MODEL;
  const tier = acornHostedLlmTier(modelId);
  if (!tier) {
    return fallback;
  }
  if (!isPro && tier === "sonnet") {
    return ACORN_HOSTED_HAIKU_MODEL;
  }
  return modelId as string;
}

export function restrictAcornHostedLlmModels(
  models: readonly string[],
  fallbackModel: string,
  isPro: boolean,
): string[] {
  const filtered = filterAcornHostedLlmModels(models, isPro);
  const resolvedFallback = resolveAcornHostedLlmModel(fallbackModel, isPro);

  if (filtered.length === 0) {
    return [resolvedFallback];
  }

  if (filtered.includes(resolvedFallback)) {
    return filtered;
  }

  if (acornHostedLlmTier(resolvedFallback)) {
    return [resolvedFallback, ...filtered];
  }

  return filtered;
}
