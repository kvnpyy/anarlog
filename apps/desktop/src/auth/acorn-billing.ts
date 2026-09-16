import type { BillingInfo } from "@anlg/supabase";

export function isLocalAcornProActive(
  enabled: boolean,
  expiresAt?: string | null,
  now = Date.now(),
): boolean {
  if (!enabled) {
    return false;
  }
  if (!expiresAt) {
    return true;
  }

  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > now;
}

export function deriveLocalAcornBilling(
  isPro: boolean,
  expiresAt?: string | null,
): BillingInfo {
  const active = isLocalAcornProActive(isPro, expiresAt);
  const currentPeriodEnd =
    expiresAt && Number.isFinite(Date.parse(expiresAt))
      ? new Date(expiresAt)
      : null;
  return {
    entitlements: active ? ["acorn_pro"] : [],
    subscriptionStatus: active ? "active" : null,
    isPro: active,
    isLite: false,
    isPaid: active,
    isTrialing: false,
    isPaused: false,
    hasPaymentMethod: false,
    trialEnd: null,
    trialDaysRemaining: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd,
    plan: active ? "pro" : "free",
  };
}
