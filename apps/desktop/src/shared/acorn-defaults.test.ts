import { afterEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  VITE_ACORN_DEFAULT_LLM_BASE_URL: undefined as string | undefined,
  VITE_ACORN_DEFAULT_LLM_MODEL: undefined as string | undefined,
  VITE_ACORN_DEFAULT_LLM_KIND: undefined as
    | "openai"
    | "anthropic"
    | "google"
    | undefined,
}));

vi.mock("~/env", () => ({
  env: envState,
}));

import {
  ACORN_HOSTED_API_KEY,
  ACORN_HOSTED_HAIKU_MODEL,
  ACORN_HOSTED_SONNET_MODEL,
  withAcornBundledProviders,
  getAcornDefaultLlm,
  getAcornDefaultStt,
  hydrateAcornHostedAi,
  isAcornHostedApiKey,
  listAcornHostedLlmModels,
  resolveAcornHostedLlmModel,
  restrictAcornHostedLlmModels,
} from "./acorn-defaults";

describe("Acorn bundled AI defaults", () => {
  afterEach(() => {
    envState.VITE_ACORN_DEFAULT_LLM_BASE_URL = undefined;
    envState.VITE_ACORN_DEFAULT_LLM_MODEL = undefined;
    envState.VITE_ACORN_DEFAULT_LLM_KIND = undefined;
    hydrateAcornHostedAi({});
  });

  it("does not inject providers when no hosted keys are configured", () => {
    expect(getAcornDefaultStt()).toBeNull();
    expect(getAcornDefaultLlm()).toBeNull();
    expect(withAcornBundledProviders("stt", {})).toEqual({});
    expect(withAcornBundledProviders("llm", {})).toEqual({});
  });

  it("fills Deepgram and Default with a placeholder instead of the real key", () => {
    hydrateAcornHostedAi({
      stt: true,
      llm: true,
    });
    envState.VITE_ACORN_DEFAULT_LLM_KIND = "anthropic";
    envState.VITE_ACORN_DEFAULT_LLM_MODEL = "claude-sonnet-4-5";

    expect(getAcornDefaultStt()).toEqual({
      providerId: "deepgram",
      baseUrl: "https://api.deepgram.com/v1",
      apiKey: ACORN_HOSTED_API_KEY,
      model: "nova-3-general",
    });
    expect(getAcornDefaultLlm()).toMatchObject({
      providerId: "acorn",
      kind: "anthropic",
      apiKey: ACORN_HOSTED_API_KEY,
      model: "claude-sonnet-4-5",
    });
    expect(isAcornHostedApiKey(ACORN_HOSTED_API_KEY)).toBe(true);

    expect(
      withAcornBundledProviders("stt", {
        "stt:openai": {
          type: "stt",
          base_url: "https://api.openai.com/v1",
          api_key: "user-stt",
        },
      }),
    ).toMatchObject({
      "stt:deepgram": {
        type: "stt",
        api_key: ACORN_HOSTED_API_KEY,
      },
      "stt:openai": {
        api_key: "user-stt",
      },
    });

    expect(withAcornBundledProviders("llm", {})["llm:acorn"]?.api_key).toBe(
      ACORN_HOSTED_API_KEY,
    );
  });

  it("restricts the hosted key to Haiku on Free and Sonnet or Haiku on Pro", () => {
    expect(listAcornHostedLlmModels(false)).toEqual({
      models: [ACORN_HOSTED_HAIKU_MODEL],
      ignored: [],
      metadata: {},
    });
    expect(listAcornHostedLlmModels(true)).toEqual({
      models: [ACORN_HOSTED_SONNET_MODEL, ACORN_HOSTED_HAIKU_MODEL],
      ignored: [],
      metadata: {},
    });
    expect(
      restrictAcornHostedLlmModels(
        ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5", "gpt-4o"],
        ACORN_HOSTED_SONNET_MODEL,
        false,
      ),
    ).toEqual(["claude-haiku-4-5"]);
    expect(
      restrictAcornHostedLlmModels(
        ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5", "gpt-4o"],
        ACORN_HOSTED_SONNET_MODEL,
        true,
      ),
    ).toEqual(["claude-sonnet-4-5", "claude-sonnet-4-6", "claude-haiku-4-5"]);
    expect(resolveAcornHostedLlmModel("claude-opus-4-6", false)).toBe(
      ACORN_HOSTED_HAIKU_MODEL,
    );
    expect(resolveAcornHostedLlmModel("claude-sonnet-4-5", false)).toBe(
      ACORN_HOSTED_HAIKU_MODEL,
    );
    expect(resolveAcornHostedLlmModel("claude-sonnet-4-5", true)).toBe(
      "claude-sonnet-4-5",
    );
  });

  it("does not overwrite a user-supplied key", () => {
    hydrateAcornHostedAi({ stt: true, llm: true });

    expect(
      withAcornBundledProviders("stt", {
        "stt:deepgram": {
          type: "stt",
          base_url: "https://api.deepgram.com/v1",
          api_key: "dg-user",
        },
      })["stt:deepgram"].api_key,
    ).toBe("dg-user");

    expect(
      withAcornBundledProviders("llm", {
        "llm:acorn": {
          type: "llm",
          base_url: "https://api.openai.com/v1",
          api_key: "sk-user",
        },
      })["llm:acorn"].api_key,
    ).toBe("sk-user");
  });
});
