import { env } from "~/env";
import { LOCAL_ONLY } from "~/shared/product";

export const ACORN_DEFAULT_STT_PROVIDER_ID = "deepgram";
export const ACORN_DEFAULT_LLM_PROVIDER_ID = "acorn";
export const ACORN_DEFAULT_STT_BASE_URL = "https://api.deepgram.com/v1";
export const ACORN_DEFAULT_STT_MODEL = "nova-3-general";

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
    model: "claude-sonnet-4-5",
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
};

export function getAcornDefaultLlmKind(): AcornDefaultLlmKind {
  return env.VITE_ACORN_DEFAULT_LLM_KIND ?? "openai";
}

export function getAcornDefaultStt(): {
  providerId: typeof ACORN_DEFAULT_STT_PROVIDER_ID;
  baseUrl: string;
  apiKey: string;
  model: string;
} | null {
  const apiKey = env.VITE_ACORN_DEFAULT_STT_API_KEY?.trim();
  if (!LOCAL_ONLY || !apiKey) {
    return null;
  }

  return {
    providerId: ACORN_DEFAULT_STT_PROVIDER_ID,
    baseUrl: ACORN_DEFAULT_STT_BASE_URL,
    apiKey,
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
  const apiKey = env.VITE_ACORN_DEFAULT_LLM_API_KEY?.trim();
  if (!LOCAL_ONLY || !apiKey) {
    return null;
  }

  const kind = getAcornDefaultLlmKind();
  const defaults = LLM_DEFAULTS[kind];

  return {
    providerId: ACORN_DEFAULT_LLM_PROVIDER_ID,
    kind,
    baseUrl: env.VITE_ACORN_DEFAULT_LLM_BASE_URL?.trim() || defaults.baseUrl,
    apiKey,
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
