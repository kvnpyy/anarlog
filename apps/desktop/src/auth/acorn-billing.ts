import type { BillingInfo } from "@anlg/supabase";

export function deriveLocalAcornBilling(isPro: boolean): BillingInfo {
  return {
    entitlements: isPro ? ["acorn_pro"] : [],
    subscriptionStatus: isPro ? "active" : null,
    isPro,
    isLite: false,
    isPaid: isPro,
    isTrialing: false,
    isPaused: false,
    hasPaymentMethod: false,
    trialEnd: null,
    trialDaysRemaining: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    plan: isPro ? "pro" : "free",
  };
}
