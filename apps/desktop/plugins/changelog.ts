import { readdirSync, readFileSync, watch } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const changelogDir = resolve(__dirname, "../../../packages/changelog/content");

const VIRTUAL_ID = "virtual:changelog";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

function getChangelogEntries(): { version: string; content: string }[] {
  try {
    return readdirSync(changelogDir)
      .filter((file) => file.endsWith(".md") && /^\d/.test(file))
      .map((file) => {
        const version = file.replace(/\.md$/, "");
        return {
          version,
          content: readFileSync(resolve(changelogDir, file), "utf-8"),
        };
      });
  } catch {
    return [];
  }
}

function buildModule(): string {
  const entries = getChangelogEntries();
  const versions = entries.map((entry) => entry.version);
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const latest = versions[0] ?? null;
  const latestContent =
    entries.find((entry) => entry.version === latest)?.content ?? null;
  const changelogByVersion = Object.fromEntries(
    entries.map((entry) => [entry.version, entry.content]),
  );

  return [
    `export const latestVersion = ${JSON.stringify(latest)};`,
    `export const latestContent = ${JSON.stringify(latestContent)};`,
    `export const changelogByVersion = ${JSON.stringify(changelogByVersion)};`,
  ].join("\n");
}

export function changelog(): Plugin {
  return {
    name: "changelog",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) return buildModule();
    },
    configureServer(server: ViteDevServer) {
      if (process.env.NODE_ENV === "test" || process.env.VITEST) {
        return;
      }

      try {
        watch(changelogDir, { recursive: true }, () => {
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: "full-reload" });
          }
        });
      } catch {}
    },
  };
}
