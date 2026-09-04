/// <reference types="vite/client" />

declare module "virtual:changelog" {
  export const latestVersion: string | null;
  export const latestContent: string | null;
  export const changelogByVersion: Record<string, string>;
}
