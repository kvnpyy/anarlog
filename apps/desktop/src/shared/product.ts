export const PRODUCT_NAME = "Acorn";
export const PRODUCT_TAGLINE = "Local meeting notes. Live Ask.";
export const PRODUCT_ATTRIBUTION = "Acorn is built on Anarlog (MIT).";
export const PRODUCT_COPYRIGHT = "Copyright (c) 2023-present Fastrepl, Inc.";
export const LOCAL_ONLY: boolean = true;

export const FREE_AI_WINDOW_DAYS = 14;
export const PRO_AI_WINDOW_DAYS = 365;
export const FREE_AI_WINDOW_NOTICE =
  "Free only searches the last 14 days. Acorn Pro remembers 365 days.";

export const ACORN_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "",
    subtitle: null,
    features: [
      { label: "Local notes and Live Ask", included: true },
      { label: "Bring your own STT & LLM keys", included: true },
      { label: "14-day AI memory", included: true },
      { label: "Open any note in the editor", included: true },
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
      { label: "365-day AI memory", included: true },
      { label: "Teams & shared notes", included: true },
      { label: "CLI, MCP & webhooks", included: true },
    ],
  },
];

export const ACORN_PRO_CHECKOUT_HREF = "https://acorn.so/pro";

export const HOSTED_CONNECT_UNAVAILABLE_MESSAGE =
  "Google and Outlook calendar connect isn’t available yet.";

export function withoutHostedCloudProviders<T extends { id: string }>(
  providers: readonly T[],
): T[] {
  if (!LOCAL_ONLY) {
    return [...providers];
  }

  return providers.filter((provider) => provider.id !== "anarlog");
}
