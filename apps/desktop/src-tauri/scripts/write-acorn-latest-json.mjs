#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
const desktopRoot = join(repoRoot, "apps/desktop");
const githubRepo = argValue("--repo") ?? "kvnpyy/acorn-releases";

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function platformFromName(name) {
  if (name.includes("aarch64") || name.includes("arm64")) {
    return "darwin-aarch64";
  }
  if (
    name.includes("x86_64") ||
    name.includes("x64") ||
    name.includes("intel")
  ) {
    return "darwin-x86_64";
  }
  return process.arch === "arm64" ? "darwin-aarch64" : "darwin-x86_64";
}

async function findUpdaterArtifacts(directory) {
  const names = await readdir(directory);
  const archives = names.filter((name) => name.endsWith(".app.tar.gz"));
  if (archives.length === 0) {
    throw new Error(`No .app.tar.gz updater archive in ${directory}`);
  }

  return Promise.all(
    archives.map(async (archiveName) => {
      const signatureName = `${archiveName}.sig`;
      if (!names.includes(signatureName)) {
        throw new Error(`Missing updater signature ${signatureName}`);
      }
      const signature = (
        await readFile(join(directory, signatureName), "utf8")
      ).trim();
      return {
        fileName: archiveName,
        platform: platformFromName(archiveName),
        signature,
      };
    }),
  );
}

const version = argValue("--version");
const tag = argValue("--tag") ?? (version ? `acorn-v${version}` : undefined);
const notes = argValue("--notes") ?? "Acorn update";
const artifactDir = resolve(
  argValue("--artifact-dir") ??
    join(desktopRoot, "src-tauri/target/release/bundle/macos"),
);
const outPath = resolve(argValue("--out") ?? join(artifactDir, "latest.json"));

if (!version || !tag) {
  throw new Error(
    "Usage: node write-acorn-latest-json.mjs --version 0.1.2 [--tag v0.1.2] [--repo kvnpyy/acorn-releases]",
  );
}

const artifacts = await findUpdaterArtifacts(artifactDir);
const platforms = Object.fromEntries(
  artifacts.map((artifact) => [
    artifact.platform,
    {
      signature: artifact.signature,
      url: `https://github.com/${githubRepo}/releases/download/${tag}/${artifact.fileName}`,
    },
  ]),
);

const feed = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms,
};

await writeFile(outPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
for (const artifact of artifacts) {
  console.log(`  ${artifact.platform}: ${basename(artifact.fileName)}`);
}
