import { describe, expect, it } from "vitest";

import { ACORN_HOSTED_API_KEY, hydrateAcornHostedAi } from "./acorn-defaults";
import {
  headersContainHostedPlaceholder,
  needsHostedNativeFetch,
} from "./hosted-fetch";

describe("hosted fetch auth rewrite", () => {
  it("detects the placeholder without needing the real key", () => {
    hydrateAcornHostedAi({ llm: true });
    const headers = new Headers({
      Authorization: `Bearer ${ACORN_HOSTED_API_KEY}`,
      "x-api-key": ACORN_HOSTED_API_KEY,
    });
    expect(headersContainHostedPlaceholder(headers)).toBe(true);
    expect(
      needsHostedNativeFetch(
        "https://api.openai.com/v1/chat/completions",
        headers,
      ),
    ).toBe(true);
    hydrateAcornHostedAi({});
  });

  it("leaves user keys on the normal HTTP path", () => {
    hydrateAcornHostedAi({ llm: true });
    const headers = new Headers({ Authorization: "Bearer sk-user" });
    expect(headersContainHostedPlaceholder(headers)).toBe(false);
    expect(
      needsHostedNativeFetch(
        "https://api.openai.com/v1/chat/completions",
        headers,
      ),
    ).toBe(false);
    hydrateAcornHostedAi({});
  });

  it("detects a placeholder API key in the query string", () => {
    expect(
      needsHostedNativeFetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${ACORN_HOSTED_API_KEY}`,
        new Headers(),
      ),
    ).toBe(true);
  });
});
