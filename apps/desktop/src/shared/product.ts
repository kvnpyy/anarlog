export const PRODUCT_NAME = "Acorn";
export const PRODUCT_TAGLINE = "Local meeting notes. Live Ask.";
export const PRODUCT_ATTRIBUTION = "Acorn is built on Anarlog (MIT).";
export const PRODUCT_COPYRIGHT = "Copyright (c) 2023-present Fastrepl, Inc.";
export const PRODUCT_SITE_URL = "https://acorn.so";
export const LOCAL_ONLY: boolean = true;

export const FREE_AI_WINDOW_DAYS = 30;
export const PRO_AI_WINDOW_DAYS = 365;
export const FREE_AI_WINDOW_NOTICE =
  "Free only searches the last 30 days. Acorn Pro remembers 365 days.";

export const ACORN_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "",
    subtitle: null,
    features: [
      { label: "Unlimited local notes — never locked", included: true },
      { label: "Live transcription and Live Ask", included: true },
      { label: "Default AI (Haiku)", included: true },
      {
        label: "Optional Anthropic, OpenAI, Grok, Gemini, or custom keys",
        included: true,
      },
      { label: "30-day AI memory", included: true },
      { label: "Smarter AI", included: false },
      { label: "365-day AI memory", included: false },
      { label: "Teams & shared notes", included: false },
      { label: "CLI, MCP & webhooks", included: false },
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "Coming soon",
    period: "",
    subtitle: "Checkout isn’t open yet",
    features: [
      { label: "Everything in Free", included: true },
      { label: "Smarter AI", included: true },
      { label: "365-day AI memory", included: true },
      { label: "Teams & shared notes", included: true },
      { label: "CLI, MCP & webhooks", included: true },
    ],
  },
];

export const ACORN_PRO_CHECKOUT_HREF = "https://acorn.so/pro";

export const HOSTED_SIGN_IN_UNAVAILABLE_MESSAGE =
  "Cloud sign-in isn’t available in Acorn yet.";

export function hostedConnectUnavailableMessage(integrationId?: string) {
  switch (integrationId) {
    case "outlook":
      return "Outlook calendar connect isn’t available yet.";
    case "google-calendar":
      return "Google Calendar connect isn’t available yet.";
    case "zoom":
      return "Zoom cloud import isn’t available yet. Acorn records Zoom locally — or import transcripts from files.";
    case "google-meet":
      return "Google Meet cloud import isn’t available yet. Acorn records Meet locally — or import transcripts from files.";
    case "microsoft-teams":
      return "Microsoft Teams cloud import isn’t available yet.";
    case "fathom":
    case "notion":
    case "webex":
      return "Cloud import isn’t available yet. You can still import transcripts from files.";
    default:
      return "This connection isn’t available yet.";
  }
}

export const ACORN_OWN_KEY_LLM_PROVIDER_IDS = [
  "anthropic",
  "openai",
  "xai",
  "google_generative_ai",
  "custom",
] as const;

export function withoutHostedCloudProviders<T extends { id: string }>(
  providers: readonly T[],
): T[] {
  if (!LOCAL_ONLY) {
    return [...providers];
  }

  return providers.filter((provider) => provider.id !== "anarlog");
}

export function visibleLlmProviders<
  T extends { id: string; displayName: string },
>(providers: readonly T[]): T[] {
  const withoutHosted = withoutHostedCloudProviders(providers);

  if (!LOCAL_ONLY) {
    return withoutHosted.filter((provider) => provider.id !== "acorn");
  }

  const allow = new Set<string>(["acorn", ...ACORN_OWN_KEY_LLM_PROVIDER_IDS]);
  return withoutHosted
    .filter((provider) => allow.has(provider.id))
    .map((provider) => {
      if (provider.id === "xai") {
        return { ...provider, displayName: "Grok" };
      }
      if (provider.id === "google_generative_ai") {
        return { ...provider, displayName: "Gemini" };
      }
      return provider;
    });
}
