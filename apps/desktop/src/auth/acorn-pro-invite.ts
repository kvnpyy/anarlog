import { setAcornProEntitlement } from "./acorn-pro";

import { commands as desktopCommands } from "~/types/tauri.gen";

const encoder = new TextEncoder();

export const ACORN_PRO_INVITE_CODE_HASHES: ReadonlySet<string> = new Set([
  "472290191c8fe178226e31d2eb2f5bb1442d2df8753a7e5c1ceb904f3fae001f",
  "cdda5ae2ecc81ed873e283fe651dc9ccf50a5e8398d954100042d0cf50be3f2e",
  "24999c9f91076365766584c26a68748f9d5fbe9ac7feae51d2d4bfe595619317",
  "6ac73aa1e477946884682d756bd1c86d652779c17bac88369323f6bd26f16f42",
  "04002bffc16c1ff59282b385d46edbbcdbe9689106f7159f9e5e7ea712c8b84d",
  "bfad6f7d31043a9887cfb2396a3640574e010619ffd6e75ce1147aaa84d3de9f",
  "bc191889b2eaec3a697b73385ec1c7f93894a7c301146348bf80ae353e4af3da",
  "28e60347ce1503bc720c054f86c08f3c49d16d2a592241b010129ee855a00793",
  "fda8e5163ba2c4197d23ce024f881b6af12e29d843e0e4d90ab3fc5fb402de2f",
  "a7ce7d7b9238552d066807fd8ee9695854569df03dc4285e2fc07f54cd0ad6e3",
  "4e29b33154dd1f5bdbaa97d491d493081723faa8d794ac72816b03a3bee631e2",
  "c1a0db2c57a49f3f68ed4b73d975c1838e8066037998ba26720d79ca3b1f9165",
  "715313d9d83059c86eb72b221f795c118d0632543ffc6e957bbf9421005c8f65",
  "c625c3e590c052b79b9c456552275094281ee75ce819cbbd4bf25bfe462a9c59",
  "da95272fee33e9ddb319c1ff1155c6e04de7de5230cd094a1623d15bc16e921f",
  "94f4246104220216e8f43063f9c6f0ae5733b95b5d743d8999f486ee0b2b9d4e",
]);

export function normalizeAcornProInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function hashAcornProInviteCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(normalizeAcornProInviteCode(code)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function matchesAcornProInviteHash(
  code: string,
  hashes: ReadonlySet<string> = ACORN_PRO_INVITE_CODE_HASHES,
): Promise<boolean> {
  const normalized = normalizeAcornProInviteCode(code);
  if (normalized.length < 12) {
    return false;
  }

  const digest = await hashAcornProInviteCode(normalized);
  return hashes.has(digest);
}

export type RedeemAcornProInviteResult =
  | "ok"
  | "invalid"
  | "already_pro"
  | "used";

export async function redeemAcornProInvite(
  code: string,
  alreadyPro: boolean,
  hashes: ReadonlySet<string> = ACORN_PRO_INVITE_CODE_HASHES,
): Promise<RedeemAcornProInviteResult> {
  if (alreadyPro) {
    return "already_pro";
  }

  if (!(await matchesAcornProInviteHash(code, hashes))) {
    return "invalid";
  }

  const digest = await hashAcornProInviteCode(code);
  const consumed = await desktopCommands.acornConsumeProInvite(digest);
  if (consumed.status === "error") {
    throw new Error(consumed.error);
  }
  if (consumed.data === "used") {
    return "used";
  }

  await setAcornProEntitlement(true, "invite");
  return "ok";
}
