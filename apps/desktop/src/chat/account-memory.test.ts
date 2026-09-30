import { describe, expect, it } from "vitest";

import { emailDomain, factsFromUserCorrection } from "./account-memory";

describe("account memory", () => {
  it("keeps a corrected spelling and a corrected count", () => {
    expect(factsFromUserCorrection("it's Bazaarvoice not Bizaarvoice")).toEqual(
      ["Bazaarvoice"],
    );
    expect(factsFromUserCorrection("they have 1 store in Vegas")).toEqual([
      "they have 1 store in Vegas",
    ]);
  });

  it("keys facts by the company domain, not a personal inbox", () => {
    expect(emailDomain("nichole@shoesforcrews.com")).toBe("shoesforcrews.com");
    expect(emailDomain("kevin@gmail.com")).toBeNull();
  });
});
