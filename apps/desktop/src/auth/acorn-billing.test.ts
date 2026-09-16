import { describe, expect, it } from "vitest";

import { deriveLocalAcornBilling } from "./acorn-billing";

describe("deriveLocalAcornBilling", () => {
  it("maps the local Pro flag to paid Pro entitlements", () => {
    expect(deriveLocalAcornBilling(false)).toMatchObject({
      entitlements: [],
      isPro: false,
      isPaid: false,
      plan: "free",
      subscriptionStatus: null,
    });
    expect(deriveLocalAcornBilling(true)).toMatchObject({
      entitlements: ["acorn_pro"],
      isPro: true,
      isPaid: true,
      plan: "pro",
      subscriptionStatus: "active",
    });
    expect(
      deriveLocalAcornBilling(true, "2020-01-01T00:00:00.000Z"),
    ).toMatchObject({
      isPro: false,
      isPaid: false,
      plan: "free",
    });
  });
});
