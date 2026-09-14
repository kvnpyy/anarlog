#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
const desktopRoot = join(repoRoot, "apps/desktop");
const PLATFORM_ORDER = [
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-x86_64-nsis",
  "windows-x86_64",
];

export function argValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

export function argValues(flag, argv = process.argv) {
  const values = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      values.push(argv[i + 1]);
    }
  }
  return values;
}

export function isWindowsInstaller(name) {
  return name.toLowerCase().endsWith(".exe");
}

export function platformFromName(name) {
  const lower = name.toLowerCase();
  if (isWindowsInstaller(name)) {
    return "windows-x86_64-nsis";
  }
  if (lower.includes("aarch64") || lower.includes("arm64")) {
    return "darwin-aarch64";
  }
  if (
    lower.includes("x86_64") ||
    lower.includes("x64") ||
    lower.includes("intel")
  ) {
    return "darwin-x86_64";
  }
  return process.arch === "arm64" ? "darwin-aarch64" : "darwin-x86_64";
}

export function feedKeysForPlatform(platform) {
  if (platform === "windows-x86_64-nsis") {
    return ["windows-x86_64-nsis", "windows-x86_64"];
  }
  return [platform];
}

function artifactUrl(githubRepo, tag, fileName) {
  return `https://github.com/${githubRepo}/releases/download/${tag}/${fileName}`;
}

function orderPlatforms(platforms) {
  const ordered = {};
  for (const key of PLATFORM_ORDER) {
    if (platforms[key]) {
      ordered[key] = platforms[key];
    }
  }
  for (const [key, value] of Object.entries(platforms)) {
    if (!(key in ordered)) {
      ordered[key] = value;
    }
  }
  return ordered;
}

export async function artifactFromPath(filePath, githubRepo, tag) {
  const fileName = basename(filePath);
  const signatureName = `${fileName}.sig`;
  const signaturePath = `${filePath}.sig`;
  let signature;
  try {
    signature = (await readFile(signaturePath, "utf8")).trim();
  } catch {
    throw new Error(`Missing updater signature ${signatureName}`);
  }
  if (!signature) {
    throw new Error(`Empty updater signature ${signatureName}`);
  }
  return {
    fileName,
    platform: platformFromName(fileName),
    signature,
    url: artifactUrl(githubRepo, tag, fileName),
  };
}

export async function findUpdaterArtifacts(directories, githubRepo, tag) {
  const artifacts = [];
  for (const directory of directories) {
    const names = await readdir(directory);
    const archives = names.filter(
      (name) => name.endsWith(".app.tar.gz") || isWindowsInstaller(name),
    );
    for (const archiveName of archives) {
      artifacts.push(
        await artifactFromPath(join(directory, archiveName), githubRepo, tag),
      );
    }
  }
  return artifacts;
}

export async function buildFeed({
  version,
  tag,
  notes = "Acorn update",
  githubRepo = "kvnpyy/acorn-releases",
  artifactDirs,
  windowsArtifacts = [],
  allowMissingWindows = false,
  pubDate = new Date().toISOString(),
}) {
  if (!version || !tag) {
    throw new Error(
      "Usage: node write-acorn-latest-json.mjs --version 0.1.2 [--tag v0.1.2] [--repo kvnpyy/acorn-releases] [--windows-artifact path/to/Acorn_0.1.2_x64-setup.exe]",
    );
  }

  const discovered = await findUpdaterArtifacts(artifactDirs, githubRepo, tag);
  const extraWindows = await Promise.all(
    windowsArtifacts.map((filePath) =>
      artifactFromPath(filePath, githubRepo, tag),
    ),
  );

  const artifacts = [];
  const seen = new Set();
  for (const artifact of [...discovered, ...extraWindows]) {
    if (seen.has(artifact.fileName)) {
      continue;
    }
    seen.add(artifact.fileName);
    artifacts.push(artifact);
  }

  if (
    !artifacts.some((artifact) => artifact.fileName.endsWith(".app.tar.gz"))
  ) {
    throw new Error(
      `No .app.tar.gz updater archive in ${artifactDirs.join(", ")}`,
    );
  }
  if (
    !allowMissingWindows &&
    !artifacts.some((artifact) => artifact.platform === "windows-x86_64-nsis")
  ) {
    throw new Error(
      "Missing Windows NSIS installer. Pass --windows-artifact path/to/Acorn_*_x64-setup.exe (with sibling .sig), or --allow-missing-windows.",
    );
  }

  const platforms = {};
  for (const artifact of artifacts) {
    const entry = {
      signature: artifact.signature,
      url: artifact.url,
    };
    for (const key of feedKeysForPlatform(artifact.platform)) {
      platforms[key] = entry;
    }
  }

  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: orderPlatforms(platforms),
  };
}

async function main(argv = process.argv) {
  const version = argValue("--version", argv);
  const tag =
    argValue("--tag", argv) ?? (version ? `acorn-v${version}` : undefined);
  const notes = argValue("--notes", argv) ?? "Acorn update";
  const githubRepo = argValue("--repo", argv) ?? "kvnpyy/acorn-releases";
  const artifactDirs = argValues("--artifact-dir", argv).map((directory) =>
    resolve(directory),
  );
  if (artifactDirs.length === 0) {
    artifactDirs.push(
      join(desktopRoot, "src-tauri/target/release/bundle/macos"),
    );
  }
  const windowsArtifacts = argValues("--windows-artifact", argv).map(
    (filePath) => resolve(filePath),
  );
  const outPath = resolve(
    argValue("--out", argv) ?? join(artifactDirs[0], "latest.json"),
  );

  const feed = await buildFeed({
    version,
    tag,
    notes,
    githubRepo,
    artifactDirs,
    windowsArtifacts,
    allowMissingWindows: argv.includes("--allow-missing-windows"),
  });

  await writeFile(outPath, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  for (const [platform, entry] of Object.entries(feed.platforms)) {
    console.log(`  ${platform}: ${basename(entry.url)}`);
  }
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main();
}
