import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_APP_URL: z.string().min(1).default("http://localhost:3000"),
    VITE_API_URL: z.string().min(1).default("http://localhost:3001"),
    VITE_ENTERPRISE_API_URL: z.string().url().optional(),
    VITE_SUPABASE_URL: z.string().min(1).optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    VITE_PRO_PRODUCT_ID: z.string().min(1).optional(),
    VITE_SENTRY_DSN: z.string().min(1).optional(),
    VITE_POSTHOG_API_KEY: z.string().min(1).optional(),
    VITE_POSTHOG_HOST: z.string().min(1).default("https://us.i.posthog.com"),
    VITE_GOOGLE_CALENDAR_CLIENT_SECRET: z.string().min(1).optional(),
    VITE_ACORN_DEFAULT_STT_API_KEY: z.string().min(1).optional(),
    VITE_ACORN_DEFAULT_LLM_API_KEY: z.string().min(1).optional(),
    VITE_ACORN_DEFAULT_LLM_BASE_URL: z.string().min(1).optional(),
    VITE_ACORN_DEFAULT_LLM_MODEL: z.string().min(1).optional(),
    VITE_ACORN_DEFAULT_LLM_KIND: z
      .enum(["openai", "anthropic", "google"])
      .optional(),
    VITE_APP_VERSION: z.string().min(1).optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
