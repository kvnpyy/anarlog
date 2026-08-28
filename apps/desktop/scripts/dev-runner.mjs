#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const [command, ...args] = process.argv.slice(2);
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };
const DEV_IDENTIFIER = "com.hyprnote.dev";

if (!command) {
  console.error("Expected a Cargo command or Tauri application binary path.");
  process.exit(1);
}

if (command === "run" || command === "build") {
  const cargoArgs = [];
  if (command === "run" && process.platform === "darwin") {
    cargoArgs.push(
      "--config",
      `target.'cfg(target_os = "macos")'.runner = [${JSON.stringify(scriptPath)}]`,
    );
  }
  cargoArgs.push(command, ...args);
  runChild("cargo", cargoArgs);
} else {
  if (process.platform === "darwin") {
    signBinary(command);
  }
  runChild(command, args);
}

function codesignOutput(binary, extraArgs) {
  const result = spawnSync("codesign", extraArgs.concat(binary), {
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    text: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function preferredSigningIdentity() {
  const result = spawnSync(
    "security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  const match = (result.stdout ?? "").match(/"(Apple Development:[^"]+)"/);
  return match?.[1] ?? "-";
}

function hasReusableDevSignature(binary, identity) {
  const verified = codesignOutput(binary, ["--verify"]);
  if (verified.status !== 0) {
    return false;
  }

  const details = codesignOutput(binary, ["-d", "--verbose=2"]);
  if (!details.text.includes(`Identifier=${DEV_IDENTIFIER}`)) {
    return false;
  }

  if (identity === "-") {
    return /Signature=adhoc|flags=adhoc/.test(details.text);
  }

  return details.text.includes("Authority=Apple Development");
}

function signBinary(binary) {
  const identity = preferredSigningIdentity();
  if (hasReusableDevSignature(binary, identity)) {
    return;
  }

  const scriptDirectory = dirname(scriptPath);
  const entitlements = resolve(
    scriptDirectory,
    "../src-tauri/Entitlements.plist",
  );
  const signing = spawnSync(
    "codesign",
    [
      "--force",
      "--sign",
      identity,
      "--identifier",
      DEV_IDENTIFIER,
      "--requirements",
      `=designated => identifier "${DEV_IDENTIFIER}"`,
      "--entitlements",
      entitlements,
      binary,
    ],
    { stdio: "inherit" },
  );

  if (signing.status !== 0) {
    process.exit(signing.status ?? 1);
  }
}

function runChild(executable, childArgs) {
  const child = spawn(executable, childArgs, { stdio: "inherit" });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(signalExitCodes[signal] ?? 1);
      return;
    }

    process.exit(code ?? 1);
  });
}
