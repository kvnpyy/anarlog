import { describe, expect, it } from "vitest";

import {
  HOSTED_SIGN_IN_UNAVAILABLE_MESSAGE,
  hostedConnectUnavailableMessage,
  visibleLlmProviders,
} from "./product";

describe("hostedConnectUnavailableMessage", () => {
  it("names the integration instead of always blaming Outlook", () => {
    expect(hostedConnectUnavailableMessage("outlook")).toMatch(/Outlook/i);
    expect(hostedConnectUnavailableMessage("zoom")).toMatch(/Zoom/i);
    expect(hostedConnectUnavailableMessage("zoom")).not.toMatch(/Outlook/i);
    expect(hostedConnectUnavailableMessage("google-meet")).toMatch(
      /Google Meet/i,
    );
    expect(hostedConnectUnavailableMessage()).toMatch(/This connection/i);
    expect(HOSTED_SIGN_IN_UNAVAILABLE_MESSAGE).toMatch(/sign-in/i);
    expect(HOSTED_SIGN_IN_UNAVAILABLE_MESSAGE).not.toMatch(/Outlook/i);
  });
});

describe("visibleLlmProviders", () => {
  const providers = [
    { id: "acorn", displayName: "Default" },
    { id: "openai", displayName: "OpenAI" },
    { id: "ollama", displayName: "Ollama" },
    { id: "xai", displayName: "xAI" },
    { id: "openrouter", displayName: "OpenRouter" },
    { id: "google_generative_ai", displayName: "Google Gemini" },
    { id: "custom", displayName: "Custom" },
    { id: "anthropic", displayName: "Anthropic" },
    { id: "anarlog", displayName: "Anarlog" },
  ];

  it("keeps only Default AI on Free", () => {
    expect(
      visibleLlmProviders(providers).map((provider) => provider.id),
    ).toEqual(["acorn"]);
  });

  it("keeps Default plus the bring-your-own providers on Pro", () => {
    const visible = visibleLlmProviders(providers, true);

    expect(visible.map((provider) => provider.id)).toEqual([
      "acorn",
      "openai",
      "xai",
      "google_generative_ai",
      "custom",
      "anthropic",
    ]);
    expect(visible.find((provider) => provider.id === "xai")?.displayName).toBe(
      "Grok",
    );
    expect(
      visible.find((provider) => provider.id === "google_generative_ai")
        ?.displayName,
    ).toBe("Gemini");
  });
});
