import { afterEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  VITE_ACORN_DEFAULT_STT_API_KEY: undefined as string | undefined,
  VITE_ACORN_DEFAULT_LLM_API_KEY: undefined as string | undefined,
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
  withAcornBundledProviders,
  getAcornDefaultLlm,
  getAcornDefaultStt,
} from "./acorn-defaults";

describe("Acorn bundled AI defaults", () => {
  afterEach(() => {
    envState.VITE_ACORN_DEFAULT_STT_API_KEY = undefined;
    envState.VITE_ACORN_DEFAULT_LLM_API_KEY = undefined;
    envState.VITE_ACORN_DEFAULT_LLM_BASE_URL = undefined;
    envState.VITE_ACORN_DEFAULT_LLM_MODEL = undefined;
    envState.VITE_ACORN_DEFAULT_LLM_KIND = undefined;
  });

  it("does not inject providers when no bundled keys are set", () => {
    expect(getAcornDefaultStt()).toBeNull();
    expect(getAcornDefaultLlm()).toBeNull();
    expect(withAcornBundledProviders("stt", {})).toEqual({});
    expect(withAcornBundledProviders("llm", {})).toEqual({});
  });

  it("fills Deepgram and Default when bundled keys exist", () => {
    envState.VITE_ACORN_DEFAULT_STT_API_KEY = "dg-test";
    envState.VITE_ACORN_DEFAULT_LLM_API_KEY = "sk-test";
    envState.VITE_ACORN_DEFAULT_LLM_KIND = "anthropic";
    envState.VITE_ACORN_DEFAULT_LLM_MODEL = "claude-sonnet-4-5";

    expect(getAcornDefaultStt()).toEqual({
      providerId: "deepgram",
      baseUrl: "https://api.deepgram.com/v1",
      apiKey: "dg-test",
      model: "nova-3-general",
    });
    expect(getAcornDefaultLlm()).toMatchObject({
      providerId: "acorn",
      kind: "anthropic",
      apiKey: "sk-test",
      model: "claude-sonnet-4-5",
    });

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
        api_key: "dg-test",
      },
      "stt:openai": {
        api_key: "user-stt",
      },
    });

    expect(withAcornBundledProviders("llm", {})["llm:acorn"]?.api_key).toBe(
      "sk-test",
    );
  });

  it("does not overwrite a user-supplied key", () => {
    envState.VITE_ACORN_DEFAULT_STT_API_KEY = "dg-bundled";
    envState.VITE_ACORN_DEFAULT_LLM_API_KEY = "sk-bundled";

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
