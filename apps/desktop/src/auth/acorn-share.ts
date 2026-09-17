import { setAcornProEntitlement } from "./acorn-pro";

import {
  isBusinessEmail,
  normalizeMailbox,
} from "~/contacts/company-from-email";
import { getStoredSettingValues, setSettingValues } from "~/settings/queries";
import { PRODUCT_NAME, PRODUCT_SITE_URL } from "~/shared/product";
import { commands as desktopCommands } from "~/types/tauri.gen";

export const SHARE_CODE_PATTERN = /^[a-f0-9]{24}$/;
export const SHARE_QUALIFYING_INSTALLS = 2;
export const SHARE_INVITE_MAX = 5;
export const SHARE_INVITEE_DAYS = 30;
export const SHARE_REFERRER_DAYS = 365;

export function normalizeShareCode(raw: string): string | null {
  const normalized = raw.toLowerCase().replace(/[^a-f0-9]/g, "");
  return SHARE_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function formatShareCode(code: string): string {
  const normalized = normalizeShareCode(code) ?? code.trim().toLowerCase();
  return normalized.replace(/(.{4})(?=.)/g, "$1-");
}

export function parseInviteEmails(raw: string, skipMailbox?: string): string[] {
  const skip = skipMailbox ? normalizeMailbox(skipMailbox) : undefined;
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const mailbox = normalizeMailbox(part);
    if (!mailbox || mailbox === skip || seen.has(mailbox)) {
      continue;
    }
    seen.add(mailbox);
    recipients.push(mailbox);
    if (recipients.length === SHARE_INVITE_MAX) {
      break;
    }
  }
  return recipients;
}

export function createShareCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function shareUrl(code: string): string {
  return `${PRODUCT_SITE_URL}/r/${code}`;
}

export function shareMessage(code: string): string {
  return `I'm using ${PRODUCT_NAME} for meeting notes. Get it here and confirm your work email in the app for 30 days of Pro:\n${shareUrl(code)}\nShare code: ${formatShareCode(code)}`;
}

export async function ensureShareCode(email: string): Promise<string> {
  const mailbox = normalizeMailbox(email);
  if (!mailbox) {
    throw new Error("Enter a valid email so we can send invites.");
  }

  const stored = await getStoredSettingValues();
  const existing = normalizeShareCode(stored.values.acorn_share_code ?? "");
  const code = existing ?? createShareCode();
  const registered = await desktopCommands.acornRegisterShareCode(
    code,
    mailbox,
  );
  if (registered.status === "error") {
    throw new Error(registered.error);
  }

  await setSettingValues({
    acorn_share_code: code,
    acorn_share_email: mailbox,
  });
  return code;
}

export async function loadShareStatus(code: string): Promise<{
  qualifiedCount: number;
  granted: boolean;
} | null> {
  const normalized = normalizeShareCode(code);
  if (!normalized) {
    return null;
  }

  const result = await desktopCommands.acornShareStatus(normalized);
  if (result.status === "error") {
    throw new Error(result.error);
  }

  return {
    qualifiedCount: result.data.qualified_count,
    granted: result.data.granted,
  };
}

export type SendShareInvitesResult = {
  code: string;
  sent: string[];
  failed: string[];
  emailError?: string;
};

export async function sendShareInvites(
  referrerEmail: string,
  recipientEmails: string[],
): Promise<SendShareInvitesResult> {
  const code = await ensureShareCode(referrerEmail);
  const recipients = parseInviteEmails(
    recipientEmails.join("\n"),
    referrerEmail,
  );
  if (recipients.length === 0) {
    return { code, sent: [], failed: [] };
  }

  const result = await desktopCommands.acornSendShareInvites(code, recipients);
  if (result.status === "error") {
    return {
      code,
      sent: [],
      failed: recipients,
      emailError: result.error,
    };
  }

  return {
    code,
    sent: result.data.sent,
    failed: result.data.failed,
  };
}

export type ShareRedeemStatus =
  | "ok"
  | "sent"
  | "cooldown"
  | "mismatch"
  | "expired"
  | "personal"
  | "self"
  | "duplicate"
  | "missing"
  | "invalid"
  | "full";

export async function requestShareVerify(
  code: string,
  email: string,
): Promise<ShareRedeemStatus> {
  const normalized = normalizeShareCode(code);
  if (!normalized) {
    return "invalid";
  }
  if (!normalizeMailbox(email)) {
    return "invalid";
  }
  if (!isBusinessEmail(email)) {
    return "personal";
  }

  const result = await desktopCommands.acornRequestShareVerify(
    normalized,
    email,
  );
  if (result.status === "error") {
    throw new Error(result.error);
  }

  if (result.data.status === "ok") {
    await applyShareProGrant("invitee");
  }

  return asShareRedeemStatus(result.data.status);
}

export async function confirmShareVerify(
  code: string,
  email: string,
  otp: string,
): Promise<ShareRedeemStatus> {
  const normalized = normalizeShareCode(code);
  if (!normalized) {
    return "invalid";
  }
  if (!normalizeMailbox(email)) {
    return "invalid";
  }
  if (!isBusinessEmail(email)) {
    return "personal";
  }

  const digits = otp.replace(/\D/g, "");
  if (digits.length !== 6) {
    return "invalid";
  }

  const result = await desktopCommands.acornConfirmShareVerify(
    normalized,
    email,
    digits,
  );
  if (result.status === "error") {
    throw new Error(result.error);
  }

  if (result.data.status === "ok") {
    await applyShareProGrant("invitee");
  }

  return asShareRedeemStatus(result.data.status);
}

function asShareRedeemStatus(status: string): ShareRedeemStatus {
  switch (status) {
    case "ok":
    case "sent":
    case "cooldown":
    case "mismatch":
    case "expired":
    case "personal":
    case "self":
    case "duplicate":
    case "missing":
    case "invalid":
    case "full":
      return status;
    default:
      return "invalid";
  }
}

export async function syncShareReferrerGrant(): Promise<boolean> {
  const stored = await getStoredSettingValues();
  const code = normalizeShareCode(stored.values.acorn_share_code ?? "");
  if (!code) {
    return false;
  }

  const status = await loadShareStatus(code);
  if (!status?.granted) {
    return false;
  }

  return applyShareProGrant("referrer");
}

export async function applyShareProGrant(
  kind: "invitee" | "referrer",
): Promise<boolean> {
  const days = kind === "referrer" ? SHARE_REFERRER_DAYS : SHARE_INVITEE_DAYS;
  const source = kind === "referrer" ? "share" : "share_invitee";
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const stored = await getStoredSettingValues();
  if (!shouldReplaceLocalPro(stored.values, expiresAt)) {
    return false;
  }

  await setAcornProEntitlement(true, source, expiresAt);
  return true;
}

function shouldReplaceLocalPro(
  values: {
    acorn_pro?: boolean;
    acorn_pro_source?: string;
    acorn_pro_expires_at?: string;
  },
  nextExpiresAt: string,
): boolean {
  if (values.acorn_pro !== true) {
    return true;
  }

  const source = values.acorn_pro_source;
  if (
    (source === "invite" || source === "dev") &&
    !values.acorn_pro_expires_at
  ) {
    return false;
  }

  const current = Date.parse(values.acorn_pro_expires_at || "");
  const next = Date.parse(nextExpiresAt);
  return !Number.isFinite(current) || next > current;
}
