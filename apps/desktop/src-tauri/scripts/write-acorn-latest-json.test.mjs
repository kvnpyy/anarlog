import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildFeed, platformFromName } from "./write-acorn-latest-json.mjs";

async function writeArtifact(
  directory,
  fileName,
  signature = `${fileName}-sig`,
) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, fileName), fileName);
  await writeFile(join(directory, `${fileName}.sig`), `${signature}\n`);
}

test("does not treat a Windows x64 installer as a Mac Intel archive", () => {
  assert.equal(
    platformFromName("Acorn_0.1.13_x64-setup.exe"),
    "windows-x86_64-nsis",
  );
  assert.equal(platformFromName("Acorn_aarch64.app.tar.gz"), "darwin-aarch64");
  assert.equal(
    platformFromName("Acorn_0.1.13_x64.app.tar.gz"),
    "darwin-x86_64",
  );
});

test("writes Mac and both Windows updater keys from one NSIS installer", async () => {
  const root = await mkdtemp(join(tmpdir(), "acorn-latest-"));
  const macDir = join(root, "macos");
  const winDir = join(root, "windows");
  await writeArtifact(macDir, "Acorn_aarch64.app.tar.gz", "mac-sig");
  await writeArtifact(winDir, "Acorn_0.1.13_x64-setup.exe", "win-sig");

  const feed = await buildFeed({
    version: "0.1.13",
    tag: "v0.1.13",
    notes: "Acorn 0.1.13",
    artifactDirs: [macDir],
    windowsArtifacts: [join(winDir, "Acorn_0.1.13_x64-setup.exe")],
    pubDate: "2026-09-11T17:39:16.142Z",
  });

  assert.deepEqual(Object.keys(feed.platforms), [
    "darwin-aarch64",
    "windows-x86_64-nsis",
    "windows-x86_64",
  ]);
  assert.equal(
    feed.platforms["windows-x86_64-nsis"].url,
    "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.13/Acorn_0.1.13_x64-setup.exe",
  );
  assert.equal(
    feed.platforms["windows-x86_64"].signature,
    feed.platforms["windows-x86_64-nsis"].signature,
  );
  assert.equal(feed.platforms["windows-x86_64"].signature, "win-sig");
  assert.equal(
    feed.platforms["darwin-aarch64"].url,
    "https://github.com/kvnpyy/acorn-releases/releases/download/v0.1.13/Acorn_aarch64.app.tar.gz",
  );
  assert.equal(feed.version, "0.1.13");
});

test("refuses a Mac-only feed unless allow-missing-windows is set", async () => {
  const macDir = await mkdtemp(join(tmpdir(), "acorn-mac-"));
  await writeArtifact(macDir, "Acorn_aarch64.app.tar.gz", "mac-sig");

  await assert.rejects(
    () =>
      buildFeed({
        version: "0.1.14",
        tag: "v0.1.14",
        artifactDirs: [macDir],
      }),
    /Missing Windows NSIS installer/,
  );

  const feed = await buildFeed({
    version: "0.1.14",
    tag: "v0.1.14",
    artifactDirs: [macDir],
    allowMissingWindows: true,
    pubDate: "2026-09-14T00:00:00.000Z",
  });
  assert.deepEqual(Object.keys(feed.platforms), ["darwin-aarch64"]);
});
