import { commands as openerCommands } from "@anlg/plugin-opener2";

import { extendAcornPro } from "./acorn-pro";

import { getStoredSettingValues, setSettingValues } from "~/settings/queries";

export const LINKEDIN_COMPANY_URL =
  "https://www.linkedin.com/company/useacorn/";
export const LINKEDIN_FOLLOW_DAYS = 30;
// LinkedIn only exposes followers to page admins, so the app cannot confirm
// a follow. The check is a fixed wait that always grants.
export const LINKEDIN_CHECK_MS = 15_000;

export async function openLinkedInCompanyPage(): Promise<void> {
  await openerCommands.openUrl(LINKEDIN_COMPANY_URL, null);
}

let linkedInGrant: Promise<boolean> | null = null;

export function grantLinkedInFollow(): Promise<boolean> {
  linkedInGrant ??= applyLinkedInGrant().finally(() => {
    linkedInGrant = null;
  });
  return linkedInGrant;
}

async function applyLinkedInGrant(): Promise<boolean> {
  const stored = await getStoredSettingValues();
  if (stored.values.acorn_linkedin_granted_at) {
    return false;
  }

  await extendAcornPro("linkedin", LINKEDIN_FOLLOW_DAYS);
  await setSettingValues({
    acorn_linkedin_granted_at: new Date().toISOString(),
  });
  return true;
}
